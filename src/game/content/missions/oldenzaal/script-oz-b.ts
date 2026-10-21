/**
 * oz-b's script (INTEGRATE, wave A; docs/design/oldenzaal.md §2, §4): late dusk at the corner of
 * De Smulhoek. A small fight on the approach (`OZ_B_ARENAS.approach`), the corner's lock
 * (`OZ_B_WU_ARENA`: the last hosts, then MENEER WU's scene: his lines, the meal for each living
 * hero), the theme rises, then a short fight on the way to Plechelmusplein: bunched groups of
 * hosts for the frikandel's holy-mayo blast and targets for the snack power, the square's lock
 * (`OZ_B_ARENAS.square`: the bouncer, souls, a tight pack) and the exit to oz-c.
 *
 * Meneer Wu stands in De Smulhoek's door from the start (wiping the counter: the fryer keeps
 * going through the zombie night); the scene uses him (`wuScene(ctx, { doorX, wu })`).
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { OZ_THEME_RISE_SLOT } from '../../music/oldenzaal';
import { setDarkness } from '../../oldenzaal/kit/light-api';
import { wuScene } from '../../oldenzaal/npcs/index';
import { OZ_POSSESSED, OZ_SECTION, OZ_SONG, OZ_WUGHOST } from './ids';
import { hardOnly, normalUp, prewarm, twoPlayers } from './helpers';
import { chimneySoul, drainSoul, OZ_STREET_ART, streetLeft, streetRight, townsfolk, waitArena, type Townsfolk } from './script-kit';
import { G, OZ_B_ARENAS, OZ_B_DOOR_X, OZ_B_W, OZ_B_WU_ARENA } from './terrain';

const { shambler: SHAMBLER, gunner: GUNNER, brute: BRUTE } = OZ_POSSESSED;

const OZ_B_TOWNSFOLK: readonly Townsfolk[] = [
  [330, 'pensioner', 'hide'],
  [1000, 'shopper', 'idle'],
  [1220, 'student', 'hide'],
  [1560, 'vendor', 'idle'],
];

/** A tight pack of shamblers walking in from the right (a target for the holy-mayo blast). */
function pack(ctx: SectionContext, n: number, tag?: string): void {
  const looks = ['shopper', 'jogger', 'student', 'vendor', 'pensioner'];
  for (let k = 0; k < n; k++) streetRight(ctx, SHAMBLER, { look: looks[k % looks.length] }, 16 + k * 15, tag);
}

export function* scriptOzB(ctx: SectionContext): ScriptGen {
  prewarm(...OZ_STREET_ART, 'npc/oz-wu/', 'item/pickup-oz-meal', 'fx/oz/mayo/');
  townsfolk(ctx, OZ_B_TOWNSFOLK);
  // Meneer Wu in his door: the fryer keeps going.
  const wu: Entity = ctx.spawn(OZ_WUGHOST.wu, OZ_B_DOOR_X, G, { facing: -1, mode: 'wipe' });

  // @0: the approach: a soul out of the drain, two hosts.
  yield 40;
  streetRight(ctx, SHAMBLER, { look: 'vendor' });
  drainSoul(ctx);
  yield 90;
  streetRight(ctx, SHAMBLER, { look: 'jogger' });
  yield ctx.waitCamera(OZ_B_ARENAS.approach[0]);
  // @120: LOCK — the approach: hosts both ways, a gunner, a soul.
  ctx.lockCamera(OZ_B_ARENAS.approach[0], OZ_B_ARENAS.approach[1]);
  const B1 = 'oz-b1';
  streetRight(ctx, SHAMBLER, { look: 'shopper' }, 16, B1);
  streetLeft(ctx, SHAMBLER, { look: 'student' }, 16, B1);
  yield 70;
  streetRight(ctx, GUNNER, { look: 'pensioner' }, 16, B1);
  drainSoul(ctx, B1);
  yield 80;
  streetRight(ctx, SHAMBLER, { look: 'jogger' }, 16, B1);
  if (normalUp(ctx)) streetLeft(ctx, SHAMBLER, { look: 'vendor' }, 16, B1);
  if (twoPlayers(ctx)) streetRight(ctx, SHAMBLER, { look: 'shopper' }, 40, B1);
  yield* waitArena(ctx, B1);
  yield 20;
  ctx.unlockCamera();

  // @470: LOCK — the corner of De Smulhoek: the last hosts in front of the snack bar, then the scene.
  yield 20;
  streetRight(ctx, SHAMBLER, { look: 'pensioner' });
  yield ctx.waitCamera(OZ_B_WU_ARENA[0] - 100);
  const B2 = 'oz-b2';
  streetRight(ctx, SHAMBLER, { look: 'student' }, 16, B2);
  streetRight(ctx, SHAMBLER, { look: 'shopper' }, 34, B2);
  drainSoul(ctx, B2);
  yield ctx.waitCamera(OZ_B_WU_ARENA[0]);
  ctx.lockCamera(OZ_B_WU_ARENA[0], OZ_B_WU_ARENA[1]);
  yield 40;
  streetLeft(ctx, SHAMBLER, { look: 'vendor' }, 16, B2);
  chimneySoul(ctx, [OZ_B_WU_ARENA[0] + 300, 64], B2);
  if (normalUp(ctx)) {
    yield 60;
    streetRight(ctx, GUNNER, { look: 'jogger' }, 16, B2);
  }
  yield* waitArena(ctx, B2);
  // The scene does not wait for enemies (WUGHOST): every possessed on the corner is gone first.
  yield* waitArena(ctx, 'enemy');
  yield 30;
  // MENEER WU (spec §4.2): the input locks, his lines, the meal for each living hero.
  yield* wuScene(ctx, { doorX: OZ_B_DOOR_X, wu });
  // The theme rises (AUDIO: the choir comes in, the bass climbs).
  ctx.music(OZ_SONG.theme, 30, { from: OZ_THEME_RISE_SLOT, restart: true });
  setDarkness(ctx.world, 0.52, 900);
  yield 20;
  ctx.unlockCamera();

  // The way to the square: packs of hosts for the frikandels, souls for the snack power.
  yield 30;
  pack(ctx, normalUp(ctx) ? 4 : 3);
  yield ctx.waitCamera(700);
  drainSoul(ctx);
  streetRight(ctx, GUNNER, { look: 'student' });
  yield ctx.waitCamera(820);
  streetLeft(ctx, SHAMBLER, { look: 'pensioner' });
  yield 50;
  pack(ctx, 3);
  yield ctx.waitCamera(980);
  drainSoul(ctx);
  streetRight(ctx, SHAMBLER, { look: 'jogger' });
  yield ctx.waitCamera(1120);
  streetRight(ctx, GUNNER, { look: 'vendor' });
  streetLeft(ctx, SHAMBLER, { look: 'shopper' });

  // @1300: LOCK — the street opens toward the square: the bouncer, a tight pack, souls.
  yield ctx.waitCamera(OZ_B_ARENAS.square[0]);
  ctx.lockCamera(OZ_B_ARENAS.square[0], OZ_B_ARENAS.square[1]);
  const B3 = 'oz-b3';
  pack(ctx, normalUp(ctx) ? 5 : 4, B3);
  yield 80;
  drainSoul(ctx, B3);
  streetLeft(ctx, SHAMBLER, { look: 'student' }, 16, B3);
  yield 80;
  streetRight(ctx, BRUTE, { look: 'bouncer' }, 24, B3);
  yield 90;
  chimneySoul(ctx, [OZ_B_ARENAS.square[0] + 260, 66], B3);
  if (normalUp(ctx)) streetRight(ctx, GUNNER, { look: 'pensioner' }, 16, B3);
  yield 60;
  yield () => ctx.world.countAlive(B3) <= 2;
  pack(ctx, 3, B3);
  if (twoPlayers(ctx)) streetLeft(ctx, SHAMBLER, { look: 'jogger' }, 16, B3);
  if (hardOnly(ctx)) streetLeft(ctx, BRUTE, { look: 'butcher' }, 16, B3);
  yield* waitArena(ctx, B3);
  yield 20;
  ctx.unlockCamera();
  yield ctx.waitPlayerX(OZ_B_W - 64);
  yield ctx.exitTo(OZ_SECTION.c);
}
