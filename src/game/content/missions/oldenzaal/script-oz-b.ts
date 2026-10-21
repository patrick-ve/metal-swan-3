/**
 * oz-b's script (INTEGRATE; revision 2, docs/design/oldenzaal.md §2, §4): late dusk at the corner
 * of De Smulhoek, the only shop in town that is still open. A small fight on the approach
 * (`OZ_B_ARENAS.approach`: a boarded window and door burst, a crawler out of the drain), the
 * corner's lock (`OZ_B_WU_ARENA`: no openings there, the corner stays calm; the last dead walk in,
 * then MENEER WU's scene: his lines, the meal for each living hero), the theme rises, then the way
 * to Plechelmusplein: a tight column marching in (a target for the frikandel explosion) and the
 * square's lock (`OZ_B_ARENAS.square`: a column out of the fog, the shops burst, the MG zombie).
 *
 * Meneer Wu stands in De Smulhoek's door from the start (wiping the counter: the fryer keeps
 * going while the dead walk, R2-12); the scene uses him (`wuScene(ctx, { doorX, wu })`).
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { OZ_THEME_RISE_SLOT } from '../../music/oldenzaal';
import { setDarkness } from '../../oldenzaal/kit/light-api';
import { wuScene } from '../../oldenzaal/npcs/index';
import { OZ_ZOMBIE_TAG, zombiesAlive, type ZombieKind } from '../../oldenzaal/zombies/api';
import { OZ_SECTION, OZ_SONG, OZ_WUGHOST } from './ids';
import { hardOnly, normalUp, prewarm, twoPlayers } from './helpers';
import { OZ_ZOMBIE_ART, waitArena, weaponDrop, zBurst, zLeft, zManhole, zMarch, zRight, zRise } from './script-kit';
import { G, OZ_B_ARENAS, OZ_B_DOOR_X, OZ_B_W, OZ_B_WU_ARENA } from './terrain';

/** A tight column after the meal (the frikandel explosion's target: they walk bunched, in step). */
function mealColumn(ctx: SectionContext): ZombieKind[] {
  return normalUp(ctx) ? ['grunt', 'grunt', 'grunt', 'grunt'] : ['grunt', 'grunt', 'grunt'];
}

/** The column out of the fog toward the square. */
function squareColumn(ctx: SectionContext): ZombieKind[] {
  return normalUp(ctx) ? ['grunt', 'grunt', 'rifleman', 'grunt', 'grunt'] : ['grunt', 'rifleman', 'grunt'];
}

export function* scriptOzB(ctx: SectionContext): ScriptGen {
  prewarm(...OZ_ZOMBIE_ART, 'npc/oz-wu/', 'item/pickup-oz-meal', 'fx/oz/mayo/');
  // Meneer Wu in his door: the fryer keeps going.
  const wu: Entity = ctx.spawn(OZ_WUGHOST.wu, OZ_B_DOOR_X, G, { facing: -1, mode: 'wipe' });

  // @0: the approach: one walks in out of the dusk.
  yield 40;
  zRight(ctx, 'grunt');
  yield ctx.waitCamera(OZ_B_ARENAS.approach[0]);
  // @80: LOCK — the approach: the music shop's window and the bakery's door burst, a crawler out of the drain.
  ctx.lockCamera(OZ_B_ARENAS.approach[0], OZ_B_ARENAS.approach[1]);
  const B1 = 'oz-b1';
  zBurst(ctx, 'grunt', 192, { tag: B1 });
  yield 80;
  zManhole(ctx, 'crawler', 290, { tag: B1 });
  yield 90;
  zBurst(ctx, 'grunt', 327, { tag: B1 });
  if (normalUp(ctx)) zRight(ctx, 'rifleman', { tag: B1 });
  if (twoPlayers(ctx)) zLeft(ctx, 'grunt', { tag: B1 });
  yield* waitArena(ctx, B1);
  yield 20;
  ctx.unlockCamera();

  // LOCK — the corner of De Smulhoek: the last dead in front of the snack bar, then the scene.
  yield 20;
  zRise(ctx, 'grunt', ctx.camera.right - 60);
  yield 120;
  zRight(ctx, 'grunt');
  yield ctx.waitCamera(OZ_B_WU_ARENA[0] - 60);
  const B2 = 'oz-b2';
  zRight(ctx, 'grunt', { tag: B2 });
  yield ctx.waitCamera(OZ_B_WU_ARENA[0]);
  ctx.lockCamera(OZ_B_WU_ARENA[0], OZ_B_WU_ARENA[1]);
  yield 40;
  // The crawler comes up out of a drain close to the heroes (FIX: from the far edge it dragged
  // ~250 px at 0.36 px/tick, a 10 s dead stretch before Wu's scene).
  if (normalUp(ctx)) zManhole(ctx, 'crawler', ctx.camera.right - 90, { tag: B2 });
  yield* waitArena(ctx, B2);
  // The scene does not wait for enemies (WUGHOST): every dead soldier on the corner is down first.
  yield* waitArena(ctx, OZ_ZOMBIE_TAG);
  yield 30;
  // MENEER WU (spec §4.2): the input locks, his lines, the meal for each living hero.
  yield* wuScene(ctx, { doorX: OZ_B_DOOR_X, wu });
  // The theme rises (AUDIO: the choir comes in, the bass climbs).
  ctx.music(OZ_SONG.theme, 30, { from: OZ_THEME_RISE_SLOT, restart: true });
  setDarkness(ctx.world, 0.54, 900);
  yield 20;
  ctx.unlockCamera();

  // The way to the square: a tight column for the frikandels, one rises, a rifleman.
  yield 40;
  zMarch(ctx, mealColumn(ctx));
  yield ctx.waitCamera(860);
  zRise(ctx, 'grunt', 940);
  yield ctx.waitCamera(980);
  zRight(ctx, 'rifleman');
  yield ctx.waitCamera(1090);
  zRise(ctx, 'crawler', 1230);

  // @1200: LOCK — the street opens toward the square: a column out of the fog, the shops burst,
  // the drains open, the MG zombie.
  yield ctx.waitCamera(OZ_B_ARENAS.square[0]);
  ctx.lockCamera(OZ_B_ARENAS.square[0], OZ_B_ARENAS.square[1]);
  const B3 = 'oz-b3';
  zMarch(ctx, squareColumn(ctx), B3);
  yield 120;
  zBurst(ctx, 'grunt', 1348, { tag: B3 });
  yield 120;
  zManhole(ctx, 'crawler', 1520, { tag: B3 });
  yield 100;
  zRight(ctx, 'gunner', { tag: B3, drop: weaponDrop('shotgun') });
  yield 60;
  yield () => zombiesAlive(ctx.world, B3) <= 2;
  zBurst(ctx, 'grunt', 1420, { tag: B3 });
  zBurst(ctx, 'grunt', 1602, { tag: B3, delay: 40 });
  if (normalUp(ctx)) zManhole(ctx, 'grunt', 1700, { tag: B3, delay: 60 });
  if (twoPlayers(ctx)) zLeft(ctx, 'grunt', { tag: B3 });
  if (hardOnly(ctx)) zRight(ctx, 'gunner', { tag: B3 });
  yield* waitArena(ctx, B3);
  yield 20;
  ctx.unlockCamera();
  yield ctx.waitPlayerX(OZ_B_W - 64);
  yield ctx.exitTo(OZ_SECTION.c);
}
