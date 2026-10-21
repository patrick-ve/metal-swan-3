/**
 * oz-e's script (CHURCH, wave B; docs/design/oldenzaal.md §7.2): THE CRYPT, about 1:00.
 *
 * Down the stair from the choir into the low crypt (almost dark: votive candles, lanterns, dust
 * in the air, water dripping). The dead climb out of the tombs (the lids grind and slide off),
 * crawlers drag themselves along the floor. At the iron gate a short LOCKED FIGHT (the gate is
 * chained; the tombs before it open, crawlers come from the dark behind); then the gate creaks
 * open, one more tomb, and the narrow stair goes up to the tower door (→ oz-f).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { OZ_CHURCH_ENTITY, type OzCryptGate, type OzTomb } from '../../oldenzaal/church/index';
import { CRYPT_ARENA, CRYPT_GATE_X, CRYPT_TOMBS, CRYPT_W, G } from '../../oldenzaal/church/layout';
import { spawnZombie, type ZombieKind } from '../../oldenzaal/zombies/api';
import { hardOnly, normalUp, twoPlayers } from './helpers';
import { OZ_SECTION } from './ids';
import { waitArena } from './script-kit';

/** The crypt's set-piece props (the scripts and the tests use them). */
export interface CryptProps {
  tombs: Map<number, OzTomb>;
  gate: OzCryptGate;
}

/** Spawn the crypt's props: the tombs, the gate, the ambient motes and drips. */
export function placeCrypt(ctx: SectionContext): CryptProps {
  const tombs = new Map<number, OzTomb>();
  for (const x of CRYPT_TOMBS) tombs.set(x, ctx.spawn(OZ_CHURCH_ENTITY.tomb, x, G) as OzTomb);
  const gate = ctx.spawn(OZ_CHURCH_ENTITY.cryptGate, CRYPT_GATE_X, G) as OzCryptGate;
  ctx.spawn(OZ_CHURCH_ENTITY.ambient, 0, G, { motes: 1, drip: 220 });
  return { tombs, gate };
}

/** Openings a zombie of this script already uses (one zombie per tomb). */
const claimed = new WeakSet<object>();

/** A zombie climbs out of the tomb at x (once). */
function fromTomb(ctx: SectionContext, props: CryptProps, x: number, kind: ZombieKind, tag?: string, delay = 0): void {
  const tomb = props.tombs.get(x);
  if (!tomb || !tomb.closed || tomb.busy || claimed.has(tomb)) return;
  claimed.add(tomb);
  spawnZombie(ctx, kind, x, 'ground', { kind: 'rise', target: tomb, surface: 'tomb', delay }, { tag });
}

export function* scriptOzE(ctx: SectionContext): ScriptGen {
  const props = placeCrypt(ctx);
  // The chained gate holds the squad until the fight before it is won.
  const wall = ctx.bodyWall(CRYPT_GATE_X - 8, { keep: 'left' });

  // The first tombs.
  yield ctx.waitPlayerX(150);
  fromTomb(ctx, props, CRYPT_TOMBS[0], 'grunt');
  yield 70;
  spawnZombie(ctx, 'crawler', ctx.camera.right + 12, 'ground', 'walk', { facing: -1 });
  yield ctx.waitPlayerX(330);
  fromTomb(ctx, props, CRYPT_TOMBS[1], 'grunt');
  if (normalUp(ctx)) fromTomb(ctx, props, CRYPT_TOMBS[2], 'rifleman', undefined, 50);

  // THE GATE (a lock): the tombs before it open, crawlers come from the dark behind.
  yield ctx.waitCamera(CRYPT_ARENA[0]);
  ctx.lockCamera(CRYPT_ARENA[0], CRYPT_ARENA[1]);
  const E = 'oz-e2';
  fromTomb(ctx, props, CRYPT_TOMBS[2], 'grunt', E);
  fromTomb(ctx, props, CRYPT_TOMBS[3], 'grunt', E, 20);
  yield 70;
  fromTomb(ctx, props, CRYPT_TOMBS[4], normalUp(ctx) ? 'rifleman' : 'grunt', E);
  yield 60;
  spawnZombie(ctx, 'crawler', ctx.camera.left - 14, 'ground', 'walk', { tag: E, facing: 1 });
  if (normalUp(ctx)) {
    yield 70;
    spawnZombie(ctx, 'crawler', ctx.camera.left - 14, 'ground', 'walk', { tag: E, facing: 1 });
  }
  if (hardOnly(ctx)) spawnZombie(ctx, 'grunt', ctx.camera.left - 30, 'ground', 'walk', { tag: E, facing: 1 });
  if (twoPlayers(ctx)) spawnZombie(ctx, 'grunt', ctx.camera.left - 20, 'ground', 'walk', { tag: E, facing: 1 });
  // The second wave when the first is almost down: a grunt from the dark behind, crawlers.
  yield 2;
  yield () => ctx.world.countAlive(E) <= 1;
  spawnZombie(ctx, 'grunt', ctx.camera.left - 16, 'ground', 'walk', { tag: E, facing: 1 });
  yield 50;
  spawnZombie(ctx, 'crawler', ctx.camera.left - 14, 'ground', 'walk', { tag: E, facing: 1 });
  if (normalUp(ctx)) spawnZombie(ctx, 'rifleman', ctx.camera.left - 34, 'ground', 'walk', { tag: E, facing: 1 });
  yield 2;
  yield* waitArena(ctx, E);
  yield 30;
  props.gate.swingOpen();
  wall.remove();
  yield 24;
  ctx.unlockCamera();

  // Beyond the gate: the last tombs, crawlers in the dark, one coming down the tower stair.
  yield ctx.waitPlayerX(CRYPT_TOMBS[5] - 90);
  fromTomb(ctx, props, CRYPT_TOMBS[5], 'grunt');
  yield 40;
  spawnZombie(ctx, 'crawler', ctx.camera.right + 12, 'ground', 'walk', { facing: -1 });
  yield ctx.waitPlayerX(CRYPT_TOMBS[6] - 100);
  fromTomb(ctx, props, CRYPT_TOMBS[6], normalUp(ctx) ? 'rifleman' : 'grunt');
  fromTomb(ctx, props, CRYPT_TOMBS[7], 'grunt', undefined, 60);
  yield 90;
  spawnZombie(ctx, 'grunt', Math.min(CRYPT_W - 12, ctx.camera.right + 14), 'ground', 'walk', { facing: -1 });
  if (twoPlayers(ctx)) spawnZombie(ctx, 'crawler', Math.min(CRYPT_W - 12, ctx.camera.right + 30), 'ground', 'walk', { facing: -1 });
  yield ctx.waitPlayerX(CRYPT_W - 40);
  yield ctx.exitTo(OZ_SECTION.f);
}
