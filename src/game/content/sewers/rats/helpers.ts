/**
 * Helpers for the section builders of mission `sewers` (P1b: B, C, D, E; docs/design/sewers.md §3).
 *
 * ```ts
 * // A pack of 4 runners from the right screen edge, one behind the other:
 * ratPack(ctx, 4, { from: 'right' });
 * // 5 runners out of a grate hole at (1980, 176), one every 14 ticks:
 * ratPack(ctx, 5, { hole: { x: 1980, y: 176 } });
 * // 3 runners dropping off the trash pile at x 700 from y 110:
 * ratPack(ctx, 3, { drop: { x: 700, y: 110 } });
 * // A leaper in a pipe stub (mouth at y 150) and in a grate:
 * ctx.spawn('sewers-rat-leaper', 760, LEAPER.pipeY, { entry: 'pipe' });
 * ctx.spawn('sewers-rat-leaper', 2100, 176, { entry: 'grate' });
 * // A spitter on its two plinths (terrain in the section's build, the rat in the script):
 * spitterPlinths(t, 1400);                                   // terrain(w, 216)… builder
 * ctx.spawn('sewers-rat-spitter', 1400, PLINTH.y, { other: 1496 });
 * ```
 */
import type { Entity } from '../../../../engine/entity';
import type { TerrainBuilder } from '../../../../engine/terrain';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { PLINTH } from './numbers';

/** Where a pack comes from: one of `from` (a screen edge), `hole` (rising out), `drop` (falling). */
export interface RatPackEntry {
  from?: 'left' | 'right';
  hole?: { x: number; y: number };
  drop?: { x: number; y: number };
  /** The rat id (default the runner; any rat id works). */
  id?: string;
  /** Ticks between two rats out of a hole or off a height (default 14). */
  every?: number;
  /** Px between two rats from an edge (default 20) or off a height (default 14, spread both ways). */
  gap?: number;
  /** A tag for `ctx.waitClear(tag)`. */
  tag?: string;
  /** Extra params for every rat. */
  params?: SpawnParams;
}

/**
 * Spawn a pack of `n` rats (runners unless `id`), all at once in this tick: from a screen edge one
 * behind the other (`from`), out of one hole one after the other (`hole`, param `delay`), or off a
 * height spread round x (`drop`, param `delay`). Returns the rats. Default `from: 'right'`.
 */
export function ratPack(ctx: SectionContext, n: number, o: RatPackEntry = {}): Entity[] {
  const id = o.id ?? 'sewers-rat-runner';
  const every = o.every ?? 14;
  const out: Entity[] = [];
  for (let i = 0; i < n; i++) {
    const params: SpawnParams = o.tag ? { ...o.params, tag: o.tag } : { ...o.params };
    if (o.hole) {
      out.push(ctx.spawn(id, o.hole.x, o.hole.y, { ...params, entry: 'hole', delay: i * every }));
    } else if (o.drop) {
      const gap = o.gap ?? 14;
      const k = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2);
      out.push(ctx.spawn(id, o.drop.x + k * gap, o.drop.y, { ...params, entry: 'drop', delay: i * every }));
    } else {
      const side = o.from ?? 'right';
      out.push(ctx.enter(id, side, { margin: 24 + i * (o.gap ?? 20), params, tag: o.tag }));
    }
  }
  return out;
}

/**
 * The two brick plinths of a spitter (spec §3): one-way platforms at y 148, 48 px wide, centred on
 * x and x + 96 (`gap`; negative = the second one to the left). Call it in the section's terrain
 * build; spawn the spitter at (x, `PLINTH.y`) with `other: x + gap`. Returns the two centre xs.
 */
export function spitterPlinths(t: TerrainBuilder, x: number, gap: number = PLINTH.gap): [number, number] {
  const half = PLINTH.w / 2;
  t.platform(x - half, PLINTH.y, PLINTH.w);
  t.platform(x + gap - half, PLINTH.y, PLINTH.w);
  return [x, x + gap];
}
