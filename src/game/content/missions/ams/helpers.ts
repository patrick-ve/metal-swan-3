/**
 * Mission ams script helpers (a copy of the m1 helpers): the GDD wave notation (`R+16`, `L-16`, `TOP`, `[N]`, `[H]`, `[2P]`) as
 * calls, hostage / crate shorthands and the fail-soft boss wait.
 */
import type { Entity } from '../../../../engine/entity';
import { getFrames, listSprites } from '../../../../engine/sprites';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';

export { G, WATER_Y } from './art';
/** View width (px). */
export const VIEW_W = 384;

/**
 * Rasterise every sprite under `prefixes` now (section start, under the fade) so the first
 * sighting of the large Amsterdam art (the boss, the NPCs, the decor) does not cost a frame.
 */
/**
 * Tier-4 art prefixes (`SectionDef.art`) of the stag party (docs/api/stag.md §5) for the looks a
 * section spawns (every spawn passes its `look`; look 0's set also holds the selfie flash), the
 * groom, and the beer bike (its driver and the rideable bike). One look set is about 3.6 MB at 4×:
 * the sections share looks 0 and 2 so the 1P working set stays inside DENSE_BUDGET_BYTES.
 */
export function stagArt(looks: readonly number[], o: { groom?: boolean; bike?: boolean } = {}): string[] {
  const out = ['enemy/stag-partier/', 'enemy/cork/'];
  for (const l of looks) if (l > 0) out.push(`enemy/stag-partier-${l}/`);
  if (o.groom) out.push('enemy/stag-groom/');
  if (o.bike) out.push('enemy/stag-beer-bike/', 'vehicle/beer-bike/');
  return [...new Set(out)];
}

/** The looks of the stag partiers in ams (see `stagArt`). */
export const STAG_LOOKS: readonly number[] = [0, 2];

export function prewarm(...prefixes: string[]): void {
  for (const pre of prefixes) for (const id of listSprites(pre)) getFrames(id);
}

/** `[N]`: NORMAL and HARD only. */
export function normalUp(ctx: SectionContext): boolean {
  return ctx.session.difficulty !== 'easy';
}

/** `[H]`: HARD only. */
export function hardOnly(ctx: SectionContext): boolean {
  return ctx.session.difficulty === 'hard';
}

/** `[2P]`: two players are in the game. */
export function twoPlayers(ctx: SectionContext): boolean {
  return ctx.playerCount >= 2;
}

function withTag(p: SpawnParams | undefined, tag?: string): SpawnParams {
  return tag ? { ...p, tag } : (p ?? {});
}

/**
 * `R+margin`: enter just outside the right view edge (`extra` px further out, for columns) and walk
 * in, standing on the GROUND line (never on a roof ledge or a ceiling top above it; over a gap the
 * spot moves right to the next ground). When the view is held at the section's right end, the
 * entity appears at x = width − 8 instead (GDD §11.0: never outside the section bounds).
 */
export function fromRight(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string, extra = 0): Entity {
  const edge = ctx.section.width - 8;
  let x = Math.min(edge, ctx.camera.right + margin + extra);
  const t = ctx.world.terrain;
  for (let k = 0; k < 8 && !Number.isFinite(t.groundY(x)) && x + 8 <= edge; k++) x += 8;
  return ctx.spawn(id, x, 'ground', { facing: -1, enter: 'right', ...withTag(params, tag) });
}

/** `L-margin`: enter just outside the left view edge (never left of x = 8). */
export function fromLeft(ctx: SectionContext, id: string, params?: SpawnParams, margin = 16, tag?: string): Entity {
  if (ctx.camera.left - margin < 8) return ctx.spawn(id, 8, 'ground', { facing: 1, enter: 'left', ...withTag(params, tag) });
  return ctx.enter(id, 'left', { margin, params, tag });
}

/** `TOP`: drop in from above the view at x. */
export function fromTop(ctx: SectionContext, id: string, x: number, params?: SpawnParams, tag?: string): Entity {
  return ctx.enter(id, 'top', { x, params, tag });
}

/** `@x`: standing there already (y = feet; 'ground' = the ground line under x). */
export function at(ctx: SectionContext, id: string, x: number, params?: SpawnParams, y: number | 'ground' = 'ground', tag?: string): Entity {
  return ctx.spawn(id, x, y, withTag(params, tag));
}

/** `hostage kind/bind @x (drop)`. */
export function hostage(ctx: SectionContext, kind: string, bind: string, x: number, drop: string, y: number | 'ground' = 'ground', extra?: SpawnParams): Entity {
  return ctx.spawn('hostage', x, y, { kind, bind, drop, ...extra });
}

/** `crate @x (contains)`. */
export function crate(ctx: SectionContext, x: number, contains: string, y: number | 'ground' = 'ground'): Entity {
  return ctx.spawn('crate', x, y, { contains });
}

/** Wait for a boss to be defeated; without the boss module (a placeholder) wait a moment. */
export function* waitBoss(boss: Entity): ScriptGen {
  if (boss instanceof Boss) yield () => boss.defeated;
  else yield 180;
}

/** The far church carillon of sections a–c: first after 15 s, then every 40 s (ticks, no rng). */
export const CARILLON = { id: 'env/ams-carillon', first: 900, every: 2400, vol: 0.6 } as const;

/** Start the carillon of this section (a background script; the section change cancels it). */
export function carillon(ctx: SectionContext): void {
  ctx.world.scripts.run(
    function* amsCarillon(): ScriptGen {
      yield CARILLON.first;
      for (;;) {
        ctx.world.audio.sfx(CARILLON.id, { vol: CARILLON.vol });
        yield CARILLON.every;
      }
    },
    { name: 'ams carillon' },
  );
}

/** Is any wave member with this tag still alive? */
export function anyAlive(ctx: SectionContext, tag: string): boolean {
  return ctx.world.countAlive(tag) > 0;
}
