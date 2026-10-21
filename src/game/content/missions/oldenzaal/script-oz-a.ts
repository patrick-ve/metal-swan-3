/**
 * oz-a's script (INTEGRATE; revision 2, docs/design/oldenzaal.md §2, §3, §10.1, §10.3): the
 * parachute drop at dusk over the dark roofs into the ABANDONED shopping street, and the dead
 * soldiers of the old war coming out of it: they break out of the boarded shops, climb out of
 * the manholes, rise from the pavers and, before the two big fights, a slow column marches in out
 * of the fog at the street's far end. Three camera locks (`OZ_A_ARENAS`, wider than a view so the
 * squad can back off from the slow dead), the golden record on the second-floor ledge, the dusk
 * darkening step by step, and the exit to the corner of De Smulhoek (oz-b). No ghosts here
 * (R2-6): Mevrouw Winkel appears only on the square.
 *
 * Tank pacing (R2-1, spec §16): fewer, tougher enemies; each lock has ONE MG zombie at most (the
 * threat of the fight), and the heroes get the firepower first: a machine-gun crate before the
 * first lock, the MG zombie of the middle fight drops a machine gun, a shotgun crate on the
 * way to the last fight. The layout (openings, rise spots, arenas, cars) is RUIN's (terrain.ts);
 * the openings are placed by `withRuin` before this script runs; the dead are ZOMBIES'.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { setDarkness } from '../../oldenzaal/kit/light-api';
import { zombiesAlive, type ZombieKind } from '../../oldenzaal/zombies/api';
import { hardOnly, normalUp, prewarm, twoPlayers } from './helpers';
import { OZ_SECTION } from './ids';
import { crateAt, OZ_ZOMBIE_ART, waitArena, weaponDrop, zBurst, zLeft, zManhole, zMarch, zRight, zRise } from './script-kit';
import { OZ_A_ARENAS, OZ_A_RECORD, OZ_A_W } from './terrain';

/** The weapon crates of the street (x on the pavement, contents). */
export const OZ_A_CRATES: ReadonlyArray<readonly [number, string]> = [
  [520, 'M'],
  [2210, 'S'],
];

/** The column that marches in before the middle fight (normal and up / easy). */
function middleColumn(ctx: SectionContext): ZombieKind[] {
  return normalUp(ctx) ? ['grunt', 'grunt', 'rifleman', 'grunt'] : ['grunt', 'rifleman', 'grunt'];
}

/** The column out of the fog at the end of the street: the MG zombie at its tail. */
function endColumn(ctx: SectionContext): ZombieKind[] {
  return normalUp(ctx) ? ['grunt', 'rifleman', 'grunt', 'grunt', 'gunner'] : ['grunt', 'grunt', 'gunner'];
}

export function* scriptOzA(ctx: SectionContext): ScriptGen {
  prewarm(...OZ_ZOMBIE_ART);
  // The golden record (ALL GOLDEN RECORDS): on the second-floor ledge, awning → balcony → ledge.
  ctx.spawn('pickup-gem', OZ_A_RECORD[0], OZ_A_RECORD[1], { kind: 'golden-record' });
  for (const [x, contains] of OZ_A_CRATES) crateAt(ctx, x, contains);

  // THE DROP (introDrop): the chutes over the dark roofs; the street below is empty and still.
  yield 110;

  // @0: the first one breaks out of the boarded music shop ahead (the first burst the squad sees).
  zBurst(ctx, 'grunt', 453);
  yield 170;
  // A crawler pulls itself out of the drain behind the burst.
  zManhole(ctx, 'crawler', 300);
  yield ctx.waitCamera(150);
  zRise(ctx, 'grunt', 470);
  // The machine-gun crate stands at 520: the dead take many hits.
  yield ctx.waitCamera(330);
  zRight(ctx, 'rifleman');
  yield ctx.waitCamera(470);
  zRise(ctx, 'grunt', 735);

  // @600: LOCK — the first fight: they break out of the ironmonger's window and the bakery's
  // door, rise from the pavers, a rifleman walks in from the dark.
  yield ctx.waitCamera(OZ_A_ARENAS.first[0]);
  ctx.lockCamera(OZ_A_ARENAS.first[0], OZ_A_ARENAS.first[1]);
  const A1 = 'oz-a1';
  zBurst(ctx, 'grunt', 669, { tag: A1 });
  yield 70;
  zBurst(ctx, 'grunt', 896, { tag: A1 });
  yield 100;
  zRise(ctx, 'grunt', 960, { tag: A1 });
  if (normalUp(ctx)) zManhole(ctx, 'crawler', 1000, { tag: A1, delay: 40 });
  yield 120;
  zRight(ctx, 'rifleman', { tag: A1 });
  if (twoPlayers(ctx)) zLeft(ctx, 'grunt', { tag: A1 });
  yield 60;
  yield () => zombiesAlive(ctx.world, A1) <= 1;
  zRise(ctx, 'grunt', 735, { tag: A1 });
  if (hardOnly(ctx)) zRight(ctx, 'grunt', { tag: A1 });
  yield* waitArena(ctx, A1);
  yield 20;
  ctx.unlockCamera();

  // @1024 (checkpoint): the shopping street proper. They rise ahead, one walks in.
  yield 30;
  zRise(ctx, 'grunt', ctx.camera.right - 70);
  yield ctx.waitCamera(960);
  zRight(ctx, 'grunt');
  yield ctx.waitCamera(1100);
  zRise(ctx, 'grunt', 1440);
  // The dusk deepens.
  setDarkness(ctx.world, 0.5, 600);
  yield ctx.waitCamera(1250);
  zRight(ctx, 'crawler');

  // @1380: LOCK — the middle of the street: A COLUMN MARCHES IN OUT OF THE FOG, then the shops
  // burst, the MG zombie walks in, the drains open.
  yield ctx.waitCamera(OZ_A_ARENAS.middle[0]);
  ctx.lockCamera(OZ_A_ARENAS.middle[0], OZ_A_ARENAS.middle[1]);
  const A2 = 'oz-a2';
  zMarch(ctx, middleColumn(ctx), A2);
  yield 160;
  zBurst(ctx, 'grunt', 1481, { tag: A2 });
  yield 140;
  zRight(ctx, 'gunner', { tag: A2, drop: weaponDrop('machine-gun') });
  yield 120;
  zManhole(ctx, 'crawler', 1720, { tag: A2 });
  zBurst(ctx, 'grunt', 1593, { tag: A2, delay: 30 });
  if (twoPlayers(ctx)) zLeft(ctx, 'grunt', { tag: A2 });
  yield 60;
  yield () => zombiesAlive(ctx.world, A2) <= 2;
  zBurst(ctx, 'grunt', 1858, { tag: A2 });
  if (normalUp(ctx)) zManhole(ctx, 'grunt', 1920, { tag: A2, delay: 50 });
  if (hardOnly(ctx)) zRight(ctx, 'rifleman', { tag: A2 });
  yield* waitArena(ctx, A2);
  yield 20;
  ctx.unlockCamera();

  // @1960: past the ledge of the golden record; the coffee bar's window, a drain, the shotgun crate.
  yield 30;
  zRise(ctx, 'grunt', ctx.camera.right - 70);
  yield ctx.waitCamera(1760);
  zBurst(ctx, 'grunt', 2082);
  // @2048 (checkpoint).
  yield ctx.waitCamera(1960);
  zRight(ctx, 'rifleman');
  yield ctx.waitCamera(2080);
  zManhole(ctx, 'crawler', 2310);
  yield ctx.waitCamera(2200);
  zRise(ctx, 'grunt', 2390);
  setDarkness(ctx.world, 0.52, 600);

  // @2440: LOCK — the end of the street: the big column out of the fog (the MG zombie at its
  // tail), the drains and the shops burst around it; then on to the corner.
  yield ctx.waitCamera(OZ_A_ARENAS.end[0]);
  ctx.lockCamera(OZ_A_ARENAS.end[0], OZ_A_ARENAS.end[1]);
  const A3 = 'oz-a3';
  zMarch(ctx, endColumn(ctx), A3);
  yield 120;
  zManhole(ctx, 'crawler', 2580, { tag: A3 });
  yield 150;
  zBurst(ctx, 'grunt', 2651, { tag: A3 });
  yield 60;
  yield () => zombiesAlive(ctx.world, A3) <= 2;
  zBurst(ctx, 'grunt', 2742, { tag: A3 });
  if (normalUp(ctx)) zBurst(ctx, 'grunt', 2842, { tag: A3, delay: 50 });
  if (twoPlayers(ctx)) zRise(ctx, 'grunt', 2700, { tag: A3, delay: 20 });
  if (hardOnly(ctx)) zRight(ctx, 'gunner', { tag: A3 });
  yield* waitArena(ctx, A3);
  yield 20;
  ctx.unlockCamera();

  // The last stretch: one straggler, then round the corner.
  yield 30;
  zRise(ctx, 'grunt', 2960);
  yield ctx.waitPlayerX(OZ_A_W - 64);
  yield ctx.exitTo(OZ_SECTION.b);
}
