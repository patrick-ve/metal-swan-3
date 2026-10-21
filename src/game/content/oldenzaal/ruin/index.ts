/**
 * Mission oldenzaal — the town after the outbreak (revision 2, spec §3.3, §10.3, R2-5, R2-7; owner
 * RUIN). Manifest id 'oldenzaal/ruin'; art in ./art.ts ('oldenzaal/ruin/art').
 *
 * The openings the dead come out of (THE OPENING CONTRACT, zombies/api.ts `ZombieOpening`; the tag
 * `OZ_OPENING_TAG`):
 * - `oz-boarded` (`OZ_RUIN.boarded`) — a boarded-up shop door or shop window (`openingKind` 'door'
 *   / 'window'). `tell(ticks)`: the planks bang and shake, dust falls (sfx `oz/ruin/boards-rattle`).
 *   `open(dirX)`: planks and glass fly (tumbling planks, wood and glass debris, sfx
 *   `oz/ruin/boards-burst`) and the frame stays broken (a dark hole, a plank hanging).
 * - `oz-manhole` (`OZ_RUIN.manhole`) — a drain cover in the pavers. `tell`: it rattles and lifts
 *   (sfx `oz/ruin/cover-rattle`); `open`: it slides aside, the dark shaft stays open
 *   (`oz/ruin/cover-slide`).
 * Both are static and neutral: no hurt boxes, never shot, never despawned; drawn behind the
 * entities (z 4), so a zombie that climbs out is in front. Cosmetics use `fxRng` only.
 *
 * Params (spawn): `kind` 'door' | 'window' (oz-boarded), `left` the glass rect's left x (world),
 * `w` the window's width (art-street.ts `shopWindowX`), `outDir` -1 | 0 | 1 (default 0: the zombie
 * faces the heroes). The entity's x is its spot (`spotX`), y the street line (`floorY`).
 *
 * Placement (the layout, terrain.ts `OZ_A_OPENINGS` / `OZ_B_OPENINGS`): `placeRuin(at, defs)`
 * spawns a section's openings (the sections do it before their script: `withRuin`), and the
 * finders `ruinOpenings(world, kind?)`, `openingNear(world, x, kind?)` give them to the scripts.
 */
import { defineSfx } from '../../../../engine/audio';
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { ScriptGen } from '../../../../engine/script';
import type { World } from '../../../../engine/world';
import { debris, dust, tumble } from '../../../fx';
import type { SectionContext, SectionScript } from '../../../mission/index';
import { defineEntity, paramNum, paramStr, type SpawnParams } from '../../../registry';
import { SHOP_DOOR_W } from '../../missions/oldenzaal/art-street';
import { OZ_RUIN } from '../../missions/oldenzaal/ids';
import { BP, HP, LP, noise, tone, type Recipes } from '../../sfx/kit';
import { OZ_OPENING_TAG, type OpeningKind, type ZombieOpening } from '../zombies/api';
import { BOARD_DOOR_OY, BOARD_WIN_OY, boardWindowFrame, OZ_BOARD_WIDTHS } from './art';
import './art';

// ============================================================================================
// Sound (synth; RUIN's prefix `oz/ruin/`)
// ============================================================================================

export const OZ_RUIN_SFX: Recipes = {
  /** The tell: planks banging from behind, a nail squeal (0.7 s). */
  'oz/ruin/boards-rattle': {
    vol: 0.8,
    voices: 2,
    gap: 0.2,
    layers: [
      noise(0.06, 0.8, BP(900, 600, 1.5)),
      noise(0.06, 0.7, BP(700, 500, 1.5), { delay: 0.22 }),
      noise(0.06, 0.8, BP(800, 520, 1.5), { delay: 0.44 }),
      tone('square', 180, 140, 0.5, 0.12, { filter: LP(900) }),
      tone('sine', 1800, 2400, 0.18, 0.08, { delay: 0.3 }),
    ],
  },
  /** The burst: wood splinters, a crash of glass, planks clattering on the pavers (1.1 s). */
  'oz/ruin/boards-burst': {
    vol: 1,
    voices: 2,
    gap: 0.3,
    layers: [
      noise(0.16, 1, BP(1200, 400, 1.2)),
      tone('sine', 120, 50, 0.22, 0.6),
      noise(0.5, 0.55, HP(4200), { delay: 0.04, env: { a: 0.005, d: 0.5 } }),
      noise(0.08, 0.5, BP(600, 400, 2), { delay: 0.42 }),
      noise(0.08, 0.4, BP(700, 450, 2), { delay: 0.62 }),
    ],
  },
  /** The cover rattles in its frame: iron on iron, quick (0.6 s). */
  'oz/ruin/cover-rattle': {
    vol: 0.7,
    voices: 2,
    gap: 0.2,
    layers: [
      noise(0.05, 0.8, BP(2200, 1600, 3)),
      noise(0.05, 0.7, BP(2000, 1500, 3), { delay: 0.14 }),
      noise(0.05, 0.8, BP(2300, 1700, 3), { delay: 0.3 }),
      tone('triangle', 330, 300, 0.5, 0.15, { filter: BP(400, 400, 4) }),
    ],
  },
  /** The cover pushed aside: a heavy iron scrape over brick (0.9 s). */
  'oz/ruin/cover-slide': {
    vol: 0.9,
    voices: 2,
    gap: 0.3,
    layers: [noise(0.8, 0.8, BP(500, 1400, 1.4), { env: { a: 0.04, d: 0.76 } }), tone('saw', 90, 70, 0.8, 0.2, { filter: LP(500) }), tone('sine', 140, 60, 0.2, 0.5, { delay: 0.7 })],
  },
};
for (const [id, recipe] of Object.entries(OZ_RUIN_SFX)) defineSfx(id, recipe);

// ============================================================================================
// The openings
// ============================================================================================

const drawOpts: DrawOpts = {};

/** Shared: the tell clock and the contract's fields. */
abstract class RuinOpening extends Entity implements ZombieOpening {
  abstract readonly openingKind: OpeningKind;
  readonly spotX: number;
  readonly floorY: number;
  readonly outDir: -1 | 0 | 1;
  closed = true;
  busy = false;
  /** Ticks of the tell left (the shake). */
  protected tellLeft = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y);
    this.spotX = x;
    this.floorY = y;
    const o = paramNum(p, 'outDir', 0);
    this.outDir = o < 0 ? -1 : o > 0 ? 1 : 0;
    this.team = 'neutral';
    this.despawnMargin = Infinity;
    this.z = 4;
    this.addTag(OZ_OPENING_TAG);
  }

  /** Never hit (no hurt boxes, no contact). */
  override hurtboxes(): readonly never[] {
    return NONE;
  }

  override contactBoxes(): readonly never[] {
    return NONE;
  }

  override onHit(): boolean {
    return false;
  }

  tell(ticks: number): void {
    if (!this.closed) return;
    this.tellLeft = Math.max(this.tellLeft, Math.max(1, ticks | 0));
    this.onTell();
  }

  open(dirX: -1 | 0 | 1): void {
    if (!this.closed) return;
    this.closed = false;
    this.tellLeft = 0;
    this.onOpen(dirX);
  }

  /** Is it telling now (tests, the bot)? */
  get telling(): boolean {
    return this.tellLeft > 0;
  }

  override update(): void {
    if (this.tellLeft <= 0) return;
    this.tellLeft--;
    this.onTellTick();
  }

  protected abstract onTell(): void;
  protected abstract onTellTick(): void;
  protected abstract onOpen(dirX: -1 | 0 | 1): void;
}

const NONE: readonly never[] = [];

/** `oz-boarded`: a boarded-up shop door or window. */
export class OzBoarded extends RuinOpening {
  readonly openingKind: 'door' | 'window';
  /** The glass rect's left x and width (world). */
  readonly left: number;
  readonly w: number;
  private readonly sprite: string;
  private readonly intactFrame: number;
  /** The sprite's anchor x (the frame's left + its ox). */
  private readonly drawX: number;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    const kind = paramStr(p, 'kind', 'window') === 'door' ? 'door' : 'window';
    const w = kind === 'door' ? SHOP_DOOR_W : paramNum(p, 'w', OZ_BOARD_WIDTHS[0]);
    const left = paramNum(p, 'left', x - w / 2);
    super(world, left + w / 2, y, p);
    this.openingKind = kind;
    this.left = left;
    this.w = w;
    this.sprite = kind === 'door' ? 'prop/oz-boarded/door' : 'prop/oz-boarded/window';
    this.intactFrame = kind === 'door' ? 0 : boardWindowFrame(w);
    // The frame starts 1 px left of the glass; its anchor is floor((w + 2) / 2) in.
    this.drawX = left - 1 + Math.floor((w + 2) / 2);
    const oy = kind === 'door' ? BOARD_DOOR_OY : BOARD_WIN_OY;
    this.hitbox = { x: -w / 2 - 1, y: -oy, w: w + 2, h: oy };
  }

  protected onTell(): void {
    this.world.audio.sfx('oz/ruin/boards-rattle', { vol: 0.7 });
  }

  protected onTellTick(): void {
    const w = this.world;
    if (this.tellLeft % 7 === 3) dust(w, this.spotX + w.fxRng.range(-this.w / 2, this.w / 2), this.floorY - (this.openingKind === 'door' ? 26 : 25), 1);
  }

  protected onOpen(dirX: -1 | 0 | 1): void {
    const w = this.world;
    const cy = this.floorY - (this.openingKind === 'door' ? 15 : 14);
    debris(w, this.spotX, cy, 'wood', 7);
    if (this.openingKind === 'window') debris(w, this.spotX, cy, 'glass', 9);
    dust(w, this.spotX, this.floorY, 5);
    const n = this.openingKind === 'door' ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const vx = (dirX || (i % 2 ? 1 : -1)) * w.fxRng.range(0.6, 1.8);
      tumble(w, 'prop/oz-boarded/plank', this.spotX + w.fxRng.range(-this.w / 3, this.w / 3), cy + w.fxRng.range(-6, 6), vx, w.fxRng.range(-2.6, -1.2), { life: 46, ticksPerFrame: 4 });
    }
    w.audio.sfx('oz/ruin/boards-burst', { vol: 0.9 });
  }

  override draw(r: Renderer): void {
    if (!this.onScreen(24)) return;
    // The tell: the boards jump in their frame (1 px, every other tick pair).
    const shake = this.tellLeft > 0 ? (((this.tellLeft >> 1) & 1) === 0 ? 1 : -1) : 0;
    drawOpts.flipX = false;
    r.sprite(this.sprite, this.closed ? this.intactFrame : this.intactFrame + 1, Math.round(this.drawX + shake), Math.round(this.floorY), drawOpts);
  }
}

/** `oz-manhole`: a drain cover in the pavers. */
export class OzManhole extends RuinOpening {
  readonly openingKind = 'manhole' as const;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p);
    this.hitbox = { x: -10, y: -4, w: 30, h: 8 };
  }

  protected onTell(): void {
    this.world.audio.sfx('oz/ruin/cover-rattle', { vol: 0.7 });
  }

  protected onTellTick(): void {
    if (this.tellLeft % 6 === 2) dust(this.world, this.spotX + this.world.fxRng.range(-7, 7), this.floorY + 2, 1);
  }

  protected onOpen(): void {
    dust(this.world, this.spotX, this.floorY + 1, 6);
    debris(this.world, this.spotX, this.floorY, 'dirt', 4);
    this.world.audio.sfx('oz/ruin/cover-slide', { vol: 0.8 });
  }

  override draw(r: Renderer): void {
    if (!this.onScreen(24)) return;
    const frame = !this.closed ? 2 : this.tellLeft > 0 && ((this.tellLeft >> 2) & 1) === 0 ? 1 : 0;
    drawOpts.flipX = false;
    r.sprite('prop/oz-manhole/cover', frame, Math.round(this.spotX), Math.round(this.floorY), drawOpts);
  }
}

defineEntity(OZ_RUIN.boarded, (w, x, y, p) => new OzBoarded(w, x, y, p), {
  category: 'prop',
  description: 'oldenzaal: a boarded-up shop door / window a zombie bursts through (ZombieOpening; kind, left, w, outDir).',
});
defineEntity(OZ_RUIN.manhole, (w, x, y, p) => new OzManhole(w, x, y, p), {
  category: 'prop',
  description: 'oldenzaal: a drain cover a zombie climbs out of (ZombieOpening).',
});

// ============================================================================================
// Placement and finders
// ============================================================================================

/**
 * One opening of a section's layout (terrain.ts): a boarded door / window by its glass rect
 * (`x` = the left, `w` the window width) or a manhole by its middle `x`. `y` is the street line.
 */
export interface RuinOpeningDef {
  readonly kind: 'door' | 'window' | 'manhole';
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly outDir?: -1 | 0 | 1;
}

/** The spot x a zombie comes out at (the opening's middle). */
export function ruinSpotX(def: RuinOpeningDef): number {
  if (def.kind === 'manhole') return def.x;
  return def.x + (def.kind === 'door' ? SHOP_DOOR_W : (def.w ?? OZ_BOARD_WIDTHS[0])) / 2;
}

export type RuinOpeningEntity = OzBoarded | OzManhole;

/** The openings' sprite prefixes (a section's tier-4 `art`; the decor lists add `decor/oz-ruin/…`). */
export const OZ_RUIN_ART: readonly string[] = ['prop/oz-boarded/', 'prop/oz-manhole/'];

/** Spawn a section's openings (in `defs` order; returns them in that order). */
export function placeRuin(at: SectionContext | World, defs: readonly RuinOpeningDef[]): RuinOpeningEntity[] {
  const world: World = 'world' in at ? at.world : at;
  return defs.map((d) => {
    if (d.kind === 'manhole') return world.spawn(OZ_RUIN.manhole, d.x, d.y, { outDir: d.outDir ?? 0 }) as OzManhole;
    return world.spawn(OZ_RUIN.boarded, ruinSpotX(d), d.y, { kind: d.kind, left: d.x, w: d.w ?? SHOP_DOOR_W, outDir: d.outDir ?? 0 }) as OzBoarded;
  });
}

/** A section script that first places the section's openings (the layout), then runs `script`. */
export function withRuin(defs: readonly RuinOpeningDef[], script: SectionScript): SectionScript {
  return function* ruinThen(ctx: SectionContext): ScriptGen {
    placeRuin(ctx, defs);
    yield* script(ctx);
  };
}

function isRuin(e: Entity): e is RuinOpeningEntity {
  return e instanceof OzBoarded || e instanceof OzManhole;
}

/** The ruin openings in the world (all, or of one kind; `closedOnly` default true). */
export function ruinOpenings(world: World, kind?: 'door' | 'window' | 'manhole', closedOnly = true): RuinOpeningEntity[] {
  const out: RuinOpeningEntity[] = [];
  for (const e of world.byTag(OZ_OPENING_TAG)) {
    if (!isRuin(e) || e.removed) continue;
    if (kind && e.openingKind !== kind) continue;
    if (closedOnly && (!e.closed || e.busy)) continue;
    out.push(e);
  }
  return out;
}

/** The closed, free ruin opening nearest to x (of a kind, within `maxDx`), or null. */
export function openingNear(world: World, x: number, kind?: 'door' | 'window' | 'manhole', maxDx = Infinity): RuinOpeningEntity | null {
  let best: RuinOpeningEntity | null = null;
  let bd = maxDx;
  for (const e of ruinOpenings(world, kind)) {
    const dx = Math.abs(e.spotX - x);
    if (dx <= bd) {
      bd = dx;
      best = e;
    }
  }
  return best;
}
