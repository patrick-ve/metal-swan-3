/**
 * oz-d's script (CHURCH, wave B; docs/design/oldenzaal.md §7.1): THE NAVE, about 1:30.
 *
 * 1. The squad comes in through the red west doors (the moonlit square behind them). A few
 *    steps in, THE DOORS SLAM SHUT behind them (a camera lock): the dead break out of two grave
 *    slabs and an MG zombie walks in from the dark nave (the fight of the doors).
 * 2. Past the confessional, a slab breaks; at the side chapel of the dead LIGHTNING flashes, the
 *    iron grille rattles and swings open and A COLUMN COMES OUT OF THE CHAPEL, one after another
 *    (a lock), a crawler drags itself in.
 * 3. THE ORGAN MOANS BY ITSELF (sound only). Slabs break under the pulpit and before Mary; a
 *    column marches in from the dark and the LIGHTNING SHOWS THEM IN SILHOUETTE.
 * 4. The choir (a lock): the dead rise from the slabs before the altar and COME UP THE CRYPT
 *    STAIR. Then the candles gutter, and the squad goes down the stair to the crypt (→ oz-e).
 *
 * Respect: the zombies come from the graves and the crypt, never from the altar, the pulpit or
 * a statue; nothing in the church is damaged (the church's objects are decor or neutral props).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { OZ_CHURCH_ENTITY, OZ_CHURCH_SFX, type OzChapelGate, type OzNaveDoors, type OzSlab, type OzStairwell } from '../../oldenzaal/church/index';
import { NAVE_STAIRWELL_X } from '../../oldenzaal/church/decor';
import { G, NAVE_ARENAS, NAVE_CHAPEL_X, NAVE_CHOIR_SLAB, NAVE_DOOR_X, NAVE_SLABS, NAVE_W } from '../../oldenzaal/church/layout';
import { lightning } from '../../oldenzaal/kit/light-api';
import { marchColumn, spawnZombie, type ZombieKind } from '../../oldenzaal/zombies/api';
import { hardOnly, normalUp, twoPlayers } from './helpers';
import { OZ_SECTION } from './ids';
import { waitArena } from './script-kit';

/** The nave's set-piece props, spawned at the start (the scripts and the tests use them). */
export interface NaveProps {
  doors: OzNaveDoors;
  slabs: Map<number, OzSlab>;
  gate: OzChapelGate;
  stairwell: OzStairwell;
}

/** Spawn the nave's props: the doors, the grave slabs, the chapel's grille, the crypt stair. */
export function placeNave(ctx: SectionContext): NaveProps {
  const doors = ctx.spawn(OZ_CHURCH_ENTITY.doors, NAVE_DOOR_X, G) as OzNaveDoors;
  const slabs = new Map<number, OzSlab>();
  for (const x of [...NAVE_SLABS, NAVE_CHOIR_SLAB]) slabs.set(x, ctx.spawn(OZ_CHURCH_ENTITY.slab, x, G) as OzSlab);
  const gate = ctx.spawn(OZ_CHURCH_ENTITY.chapelGate, NAVE_CHAPEL_X, G) as OzChapelGate;
  const stairwell = ctx.spawn(OZ_CHURCH_ENTITY.stairwell, NAVE_STAIRWELL_X, G) as OzStairwell;
  return { doors, slabs, gate, stairwell };
}

/** Openings a zombie of this script already uses (one zombie per slab). */
const claimed = new WeakSet<object>();

/** A zombie breaks out of the grave slab at x (once). */
function fromSlab(ctx: SectionContext, props: NaveProps, x: number, kind: ZombieKind, tag?: string, delay = 0): void {
  const slab = props.slabs.get(x);
  if (!slab || !slab.closed || slab.busy || claimed.has(slab)) return;
  claimed.add(slab);
  spawnZombie(ctx, kind, x, 'ground', { kind: 'rise', target: slab, surface: 'slab', delay }, { tag });
}

/** Zombies come out of a reusable door opening (the chapel's grille, the crypt stair), one by one. */
function outOf(ctx: SectionContext, target: OzChapelGate | OzStairwell, kinds: readonly ZombieKind[], tag: string, gap: number): void {
  kinds.forEach((kind, i) => spawnZombie(ctx, kind, target.x, 'ground', { kind: 'burst', target, delay: i * gap }, { tag, facing: -1 }));
}

export function* scriptOzD(ctx: SectionContext): ScriptGen {
  const props = placeNave(ctx);
  const w = ctx.world;

  // ---- 1. THE DOORS SLAM (a lock with the MG zombie).
  yield ctx.waitPlayerX(196);
  yield 12;
  props.doors.slam();
  ctx.lockCamera(NAVE_ARENAS.doors[0], NAVE_ARENAS.doors[1]);
  yield 40;
  w.audio.sfx(OZ_CHURCH_SFX.candles, { vol: 0.6 });
  const D1 = 'oz-d1';
  fromSlab(ctx, props, NAVE_SLABS[0], 'grunt', D1);
  yield 50;
  fromSlab(ctx, props, NAVE_SLABS[1], 'grunt', D1);
  yield 60;
  spawnZombie(ctx, 'gunner', ctx.camera.right + 16, 'ground', 'walk', { tag: D1, facing: -1 });
  if (normalUp(ctx)) {
    yield 120;
    spawnZombie(ctx, 'crawler', ctx.camera.right + 12, 'ground', 'walk', { tag: D1, facing: -1 });
  }
  if (twoPlayers(ctx)) spawnZombie(ctx, 'grunt', ctx.camera.right + 40, 'ground', 'walk', { tag: D1, facing: -1 });
  yield 2;
  yield* waitArena(ctx, D1);
  yield 20;
  ctx.unlockCamera();

  // ---- 2. THE CHAPEL OF THE DEAD (a column out of the grille; a lock).
  yield ctx.waitPlayerX(470);
  fromSlab(ctx, props, NAVE_SLABS[2], 'grunt');
  yield ctx.waitCamera(NAVE_ARENAS.chapel[0]);
  ctx.lockCamera(NAVE_ARENAS.chapel[0], NAVE_ARENAS.chapel[1]);
  const D2 = 'oz-d2';
  lightning(w, 1);
  yield 30;
  outOf(ctx, props.gate, normalUp(ctx) ? ['grunt', 'grunt', 'rifleman', 'grunt'] : ['grunt', 'rifleman', 'grunt'], D2, 46);
  yield 150;
  spawnZombie(ctx, 'crawler', ctx.camera.right + 12, 'ground', 'walk', { tag: D2, facing: -1 });
  if (hardOnly(ctx)) spawnZombie(ctx, 'rifleman', ctx.camera.right + 30, 'ground', 'walk', { tag: D2, facing: -1 });
  if (twoPlayers(ctx)) spawnZombie(ctx, 'grunt', ctx.camera.left - 16, 'ground', 'walk', { tag: D2, facing: 1 });
  yield 2;
  yield* waitArena(ctx, D2);
  yield 20;
  ctx.unlockCamera();

  // ---- 3. THE ORGAN MOANS; the slabs under the pulpit and before Mary; a column in the lightning.
  yield 50;
  w.audio.sfx(OZ_CHURCH_SFX.organ, { vol: 0.9 });
  yield ctx.waitPlayerX(840);
  fromSlab(ctx, props, NAVE_SLABS[3], 'grunt');
  yield ctx.waitPlayerX(960);
  marchColumn(ctx, normalUp(ctx) ? ['grunt', 'rifleman', 'grunt'] : ['grunt', 'grunt'], { tag: 'oz-d3' });
  yield 50;
  lightning(w, 1);
  yield 70;
  fromSlab(ctx, props, NAVE_SLABS[4], 'rifleman');

  // ---- 4. THE CHOIR (a lock): the slabs before the altar, the dead come up the crypt stair.
  yield ctx.waitCamera(NAVE_ARENAS.choir[0]);
  ctx.lockCamera(NAVE_ARENAS.choir[0], NAVE_ARENAS.choir[1]);
  const D4 = 'oz-d4';
  lightning(w, 0.8);
  yield 20;
  fromSlab(ctx, props, NAVE_SLABS[5], 'grunt', D4);
  fromSlab(ctx, props, NAVE_CHOIR_SLAB, 'grunt', D4, 40);
  yield 80;
  outOf(ctx, props.stairwell, normalUp(ctx) ? ['crawler', 'grunt', 'rifleman'] : ['crawler', 'grunt'], D4, 50);
  if (hardOnly(ctx)) {
    yield 120;
    spawnZombie(ctx, 'gunner', ctx.camera.left - 16, 'ground', 'walk', { tag: D4, facing: 1 });
  }
  if (twoPlayers(ctx)) spawnZombie(ctx, 'grunt', ctx.camera.left - 24, 'ground', 'walk', { tag: D4, facing: 1 });
  yield 2;
  yield* waitArena(ctx, D4);
  yield 30;
  w.audio.sfx(OZ_CHURCH_SFX.candles, { vol: 0.7 });
  yield 20;
  ctx.unlockCamera();

  // Down the stair to the crypt.
  yield ctx.waitPlayerX(NAVE_W - 40);
  yield ctx.exitTo(OZ_SECTION.e);
}
