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
 *
 * Revision 3 (2026-10-21, the user: "I want more zombies as it is very easy to play against them
 * now"): bigger mixed columns, pincers and a last wave in both locks on normal and hard; easy
 * stays close to revision 2 (script-kit.ts `byTier`).
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
import { byTier, OZ_ZOMBIE_ART, SQUAD_GAP, waitArena, weaponDrop, zBurst, zLeft, zManhole, zMarch, zPincer, zRight, zRise, zSquadLeft, zSquadRight } from './script-kit';
import { G, OZ_B_ARENAS, OZ_B_DOOR_X, OZ_B_W, OZ_B_WU_ARENA } from './terrain';

/** A tight column after the meal (the frikandel explosion's target: they walk bunched, in step). */
function mealColumn(ctx: SectionContext): ZombieKind[] {
  return byTier<ZombieKind[]>(ctx, ['grunt', 'grunt', 'grunt'], ['grunt', 'grunt', 'grunt', 'grunt', 'grunt', 'grunt'], ['grunt', 'grunt', 'grunt', 'grunt', 'grunt', 'grunt']);
}

/** The column out of the fog toward the square (revision 3: mixed, a crawler under the rifle's line). */
function squareColumn(ctx: SectionContext): ZombieKind[] {
  return byTier<ZombieKind[]>(
    ctx,
    ['grunt', 'rifleman', 'grunt'],
    ['grunt', 'grunt', 'crawler', 'rifleman', 'grunt', 'grunt'],
    ['grunt', 'grunt', 'crawler', 'rifleman', 'grunt', 'rifleman'],
  );
}

export function* scriptOzB(ctx: SectionContext): ScriptGen {
  prewarm(...OZ_ZOMBIE_ART, 'npc/oz-wu/', 'item/pickup-oz-meal', 'fx/oz/mayo/');
  // Meneer Wu in his door: the fryer keeps going.
  const wu: Entity = ctx.spawn(OZ_WUGHOST.wu, OZ_B_DOOR_X, G, { facing: -1, mode: 'wipe' });
  const N = normalUp(ctx);
  const H = hardOnly(ctx);
  const P2 = twoPlayers(ctx);

  // @0: the approach: one walks in out of the dusk (a pair on normal).
  yield 40;
  if (N) zSquadRight(ctx, ['grunt', 'grunt']);
  else zRight(ctx, 'grunt');
  yield ctx.waitCamera(OZ_B_ARENAS.approach[0]);
  // @80: LOCK — the approach: the music shop's window and the bakery's door burst, a crawler out
  // of the drain; revision 3: the dead rise behind them too, a second wave from both sides.
  ctx.lockCamera(OZ_B_ARENAS.approach[0], OZ_B_ARENAS.approach[1]);
  const B1 = 'oz-b1';
  zBurst(ctx, 'grunt', 192, { tag: B1 });
  if (N) zRise(ctx, 'grunt', 130, { tag: B1, delay: 30 });
  yield 80;
  zManhole(ctx, 'crawler', 290, { tag: B1 });
  yield 90;
  zBurst(ctx, 'grunt', 327, { tag: B1 });
  if (N) zSquadRight(ctx, ['grunt', 'rifleman'], { tag: B1 });
  if (P2) zLeft(ctx, 'grunt', { tag: B1 });
  if (N) {
    yield 60;
    yield () => zombiesAlive(ctx.world, B1) <= byTier(ctx, 0, 2, 3);
    zPincer(ctx, H ? ['grunt', 'crawler', 'rifleman'] : ['grunt', 'rifleman'], H ? ['grunt', 'grunt', 'rifleman'] : ['grunt', 'grunt'], { tag: B1 });
    if (P2) {
      zRise(ctx, 'grunt', 300, { tag: B1, delay: 20 });
      zRight(ctx, 'rifleman', { tag: B1 }, 16 + 3 * SQUAD_GAP);
    }
  }
  yield* waitArena(ctx, B1);
  yield 20;
  ctx.unlockCamera();

  // LOCK — the corner of De Smulhoek: the last dead in front of the snack bar, then the scene.
  yield 20;
  zRise(ctx, 'grunt', ctx.camera.right - 60);
  yield 120;
  if (N) zSquadRight(ctx, ['grunt', 'crawler']);
  else zRight(ctx, 'grunt');
  yield ctx.waitCamera(OZ_B_WU_ARENA[0] - 60);
  const B2 = 'oz-b2';
  zRight(ctx, 'grunt', { tag: B2 });
  if (N) zLeft(ctx, 'grunt', { tag: B2 });
  yield ctx.waitCamera(OZ_B_WU_ARENA[0]);
  ctx.lockCamera(OZ_B_WU_ARENA[0], OZ_B_WU_ARENA[1]);
  yield 40;
  // The crawler comes up out of a drain close to the heroes (FIX: from the far edge it dragged
  // ~250 px at 0.36 px/tick, a 10 s dead stretch before Wu's scene).
  if (N) zManhole(ctx, 'crawler', ctx.camera.right - 90, { tag: B2 });
  if (H) zRight(ctx, 'rifleman', { tag: B2 });
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

  // The way to the square: a tight column for the frikandels, they rise, a rifleman behind a grunt.
  yield 40;
  zMarch(ctx, mealColumn(ctx));
  yield ctx.waitCamera(860);
  zRise(ctx, 'grunt', 940);
  if (N) zLeft(ctx, 'grunt');
  yield ctx.waitCamera(980);
  if (N) zSquadRight(ctx, ['grunt', 'rifleman']);
  else zRight(ctx, 'rifleman');
  yield ctx.waitCamera(1090);
  zRise(ctx, 'crawler', 1230);
  if (N) zRise(ctx, 'grunt', 1460, { delay: 40 });

  // @1200: LOCK — the street opens toward the square: a column out of the fog, the shops burst,
  // the drains open, the MG zombie behind a grunt, the dead close in from behind.
  yield ctx.waitCamera(OZ_B_ARENAS.square[0]);
  ctx.lockCamera(OZ_B_ARENAS.square[0], OZ_B_ARENAS.square[1]);
  const B3 = 'oz-b3';
  zMarch(ctx, squareColumn(ctx), B3);
  yield 120;
  zBurst(ctx, 'grunt', 1348, { tag: B3 });
  if (N) zSquadLeft(ctx, ['grunt', 'crawler'], { tag: B3 });
  yield 120;
  zManhole(ctx, 'crawler', 1520, { tag: B3 });
  yield 100;
  if (N) zRight(ctx, 'grunt', { tag: B3 });
  zRight(ctx, 'gunner', { tag: B3, drop: weaponDrop('shotgun') }, N ? 16 + SQUAD_GAP : 16);
  yield 60;
  yield () => zombiesAlive(ctx.world, B3) <= byTier(ctx, 2, 4, 5);
  zBurst(ctx, 'grunt', 1420, { tag: B3 });
  zBurst(ctx, 'grunt', 1602, { tag: B3, delay: 40 });
  if (N) zManhole(ctx, 'grunt', 1700, { tag: B3, delay: 60 });
  if (N) zRise(ctx, 'rifleman', 1650, { tag: B3, delay: 30 });
  if (P2) zLeft(ctx, 'grunt', { tag: B3 });
  if (H) zRight(ctx, 'gunner', { tag: B3 });
  if (N) {
    // Revision 3: the last of the square's fight, a pincer.
    yield 60;
    yield () => zombiesAlive(ctx.world, B3) <= byTier(ctx, 0, 3, 4);
    zPincer(ctx, ['grunt', 'rifleman'], H ? ['grunt', 'crawler', 'rifleman'] : ['grunt', 'rifleman'], { tag: B3 });
    if (P2) {
      zRise(ctx, 'grunt', 1460, { tag: B3, delay: 20 });
      zLeft(ctx, 'rifleman', { tag: B3 }, 16 + 2 * SQUAD_GAP);
    }
  }
  yield* waitArena(ctx, B3);
  yield 20;
  ctx.unlockCamera();
  yield ctx.waitPlayerX(OZ_B_W - 64);
  yield ctx.exitTo(OZ_SECTION.c);
}
