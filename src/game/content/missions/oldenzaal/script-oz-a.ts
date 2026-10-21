/**
 * oz-a's script (INTEGRATE, wave A; docs/design/oldenzaal.md §2, §3, §6, §10.1): the parachute
 * drop at dusk over the roofs into the shopping street, Mevrouw Winkel on a roof as the squad
 * drops (she raises her lantern and vanishes), frightened townspeople, waves of shamblers, a few
 * gunners, one brute, free souls from the drains and chimneys, re-possession moments (a free soul
 * that is not shot dives into a fleeing townsperson), three camera locks (`OZ_A_ARENAS`), the
 * golden record on the second-floor ledge, the dusk light darkening step by step, and the exit to
 * the corner of De Smulhoek (oz-b).
 *
 * The layout numbers (arenas, drains, alleys, chimneys, the roof, the ledge) are TOWN's
 * (terrain.ts); the possessed are POSSESSED's (`oz-shambler`, `oz-gunner`, `oz-brute`, `oz-soul`,
 * `oz-townsperson`); Mevrouw Winkel is WUGHOST's (`winkelAppear`). Pacing (GDD 1.5: no stretch of
 * more than 4 s without an enemy on screen outside a scene) is measured with the bot
 * (tmp/oz-integrate/scripts/pace.ts).
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import { setDarkness } from '../../oldenzaal/kit/light-api';
import { winkelAppear } from '../../oldenzaal/npcs/index';
import { OZ_POSSESSED, OZ_SECTION } from './ids';
import { hardOnly, normalUp, prewarm, twoPlayers } from './helpers';
import { chimneySoul, drainSoul, OZ_STREET_ART, streetLeft, streetRight, townsfolk, waitArena, type Townsfolk } from './script-kit';
import { OZ_A_ARENAS, OZ_A_RECORD, OZ_A_SPOTS, OZ_A_W, OZ_A_WINKEL_ROOF } from './terrain';

const { shambler: SHAMBLER, gunner: GUNNER, brute: BRUTE } = OZ_POSSESSED;

/** Mevrouw Winkel hovers this far right of TOWN's ridge (her bubble clears the HUD). */
const WINKEL_DX = 20;
/** …and this far lower: her feet on the roof's slope there. */
const WINKEL_DY = 9;

/** The townspeople of the street (x, look, mode): idle people flee from the possessed, others hide. */
const OZ_A_TOWNSFOLK: readonly Townsfolk[] = [
  [300, 'shopper', 'idle'],
  [560, 'pensioner', 'hide'],
  [905, 'student', 'idle'],
  [1180, 'vendor', 'idle'],
  [1520, 'jogger', 'idle'],
  [1700, 'shopper', 'hide'],
  [2120, 'pensioner', 'idle'],
  [2330, 'student', 'idle'],
  [2700, 'vendor', 'hide'],
];

export function* scriptOzA(ctx: SectionContext): ScriptGen {
  prewarm(...OZ_STREET_ART);
  townsfolk(ctx, OZ_A_TOWNSFOLK);
  // The golden record (ALL GOLDEN RECORDS): on the second-floor ledge, awning → balcony → ledge.
  ctx.spawn('pickup-gem', OZ_A_RECORD[0], OZ_A_RECORD[1], { kind: 'golden-record' });

  // THE DROP (introDrop): Mevrouw Winkel stands on the roof ridge in the opening view as the squad
  // drops; she raises her lantern, whispers her line and vanishes.
  // Her line's bubble stays clear of the HUD's top-left corner: she hovers a little right of the ridge.
  winkelAppear(ctx, OZ_A_WINKEL_ROOF[0] + WINKEL_DX, OZ_A_WINKEL_ROOF[1] + WINKEL_DY, { facing: -1, hold: 130 });
  yield 110;

  // @0: the first possessed shambles out of the alley ahead; the shopper there runs.
  streetRight(ctx, SHAMBLER, { look: 'shopper' });
  yield 120;
  drainSoul(ctx);
  yield ctx.waitCamera(120);
  streetRight(ctx, SHAMBLER, { look: 'student' });
  yield 70;
  if (normalUp(ctx)) streetRight(ctx, SHAMBLER, { look: 'vendor' });
  yield ctx.waitCamera(300);
  streetRight(ctx, GUNNER, { look: 'jogger' });
  yield 60;
  streetRight(ctx, SHAMBLER, { look: 'pensioner' });
  yield ctx.waitCamera(470);
  drainSoul(ctx);
  streetLeft(ctx, SHAMBLER, { look: 'shopper' });

  // @640: LOCK — the first fight: shamblers from both sides, a soul out of the drain, a student
  // running from them (a re-possession if the soul is not shot).
  yield ctx.waitCamera(OZ_A_ARENAS.first[0]);
  ctx.lockCamera(OZ_A_ARENAS.first[0], OZ_A_ARENAS.first[1]);
  const A1 = 'oz-a1';
  streetRight(ctx, SHAMBLER, { look: 'jogger' }, 16, A1);
  streetRight(ctx, SHAMBLER, { look: 'vendor' }, 40, A1);
  yield 60;
  streetLeft(ctx, SHAMBLER, { look: 'student' }, 16, A1);
  drainSoul(ctx, A1);
  yield 90;
  streetRight(ctx, GUNNER, { look: 'shopper' }, 16, A1);
  if (normalUp(ctx)) streetLeft(ctx, SHAMBLER, { look: 'pensioner' }, 16, A1);
  yield 90;
  streetRight(ctx, SHAMBLER, { look: 'student' }, 16, A1);
  streetRight(ctx, SHAMBLER, { look: 'shopper' }, 36, A1);
  if (twoPlayers(ctx)) streetLeft(ctx, SHAMBLER, { look: 'jogger' }, 16, A1);
  if (hardOnly(ctx)) drainSoul(ctx, A1);
  yield 60;
  yield () => ctx.world.countAlive(A1) <= 1;
  drainSoul(ctx, A1);
  streetRight(ctx, SHAMBLER, { look: 'pensioner' }, 16, A1);
  if (normalUp(ctx)) streetLeft(ctx, GUNNER, { look: 'vendor' }, 16, A1);
  yield* waitArena(ctx, A1);
  yield 20;
  ctx.unlockCamera();

  // @1024 (checkpoint): the shopping street proper. A soul out of the chimney, hosts from the alley.
  yield 30;
  streetRight(ctx, SHAMBLER, { look: 'pensioner' });
  chimneySoul(ctx, OZ_A_SPOTS.chimneys[0]);
  yield ctx.waitCamera(780);
  streetRight(ctx, SHAMBLER, { look: 'student' });
  streetRight(ctx, SHAMBLER, { look: 'vendor' }, 40);
  yield ctx.waitCamera(940);
  streetRight(ctx, GUNNER, { look: 'vendor' });
  drainSoul(ctx);
  yield 60;
  streetRight(ctx, SHAMBLER, { look: 'jogger' });
  streetRight(ctx, SHAMBLER, { look: 'shopper' }, 44);
  yield ctx.waitCamera(1200);
  drainSoul(ctx);
  streetLeft(ctx, SHAMBLER, { look: 'student' });
  yield 60;
  streetRight(ctx, SHAMBLER, { look: 'vendor' });
  // The street lamps come on: the dusk deepens.
  setDarkness(ctx.world, 0.44, 600);

  // @1400: LOCK — the middle of the street: the main fight (shamblers both ways, gunners, souls
  // out of both drains of the arena, the jogger who runs).
  yield ctx.waitCamera(OZ_A_ARENAS.middle[0]);
  ctx.lockCamera(OZ_A_ARENAS.middle[0], OZ_A_ARENAS.middle[1]);
  const A2 = 'oz-a2';
  streetRight(ctx, SHAMBLER, { look: 'shopper' }, 16, A2);
  streetLeft(ctx, SHAMBLER, { look: 'pensioner' }, 16, A2);
  yield 60;
  drainSoul(ctx, A2);
  streetRight(ctx, GUNNER, { look: 'student' }, 16, A2);
  yield 100;
  streetRight(ctx, SHAMBLER, { look: 'jogger' }, 16, A2);
  streetRight(ctx, SHAMBLER, { look: 'vendor' }, 40, A2);
  streetLeft(ctx, SHAMBLER, { look: 'shopper' }, 16, A2);
  yield 90;
  drainSoul(ctx, A2);
  if (normalUp(ctx)) streetLeft(ctx, GUNNER, { look: 'pensioner' }, 16, A2);
  yield 60;
  yield () => ctx.world.countAlive(A2) <= 2;
  streetRight(ctx, SHAMBLER, { look: 'student' }, 16, A2);
  streetRight(ctx, SHAMBLER, { look: 'shopper' }, 36, A2);
  streetRight(ctx, SHAMBLER, { look: 'jogger' }, 56, A2);
  if (twoPlayers(ctx)) streetLeft(ctx, SHAMBLER, { look: 'vendor' }, 16, A2);
  if (hardOnly(ctx)) streetLeft(ctx, GUNNER, { look: 'student' }, 16, A2);
  yield* waitArena(ctx, A2);
  yield 20;
  ctx.unlockCamera();

  // @1784: past the ledge of the golden record; souls out of the chimney over it.
  yield 30;
  chimneySoul(ctx, OZ_A_SPOTS.chimneys[1]);
  streetRight(ctx, SHAMBLER, { look: 'vendor' });
  yield ctx.waitCamera(1810);
  streetRight(ctx, SHAMBLER, { look: 'jogger' }, 30);
  streetRight(ctx, GUNNER, { look: 'shopper' });
  drainSoul(ctx);
  yield 60;
  streetRight(ctx, SHAMBLER, { look: 'pensioner' });
  // @2048 (checkpoint).
  yield ctx.waitCamera(1990);
  drainSoul(ctx);
  streetRight(ctx, SHAMBLER, { look: 'student' });
  streetRight(ctx, SHAMBLER, { look: 'jogger' }, 40);
  yield ctx.waitCamera(2140);
  streetLeft(ctx, SHAMBLER, { look: 'shopper' });
  streetRight(ctx, GUNNER, { look: 'vendor' });
  yield ctx.waitCamera(2210);
  streetRight(ctx, SHAMBLER, { look: 'jogger' });
  yield ctx.waitCamera(2280);
  drainSoul(ctx);
  streetRight(ctx, SHAMBLER, { look: 'pensioner' });
  yield 60;
  streetRight(ctx, SHAMBLER, { look: 'student' });
  if (normalUp(ctx)) streetRight(ctx, SHAMBLER, { look: 'shopper' }, 40);
  yield ctx.waitCamera(2420);
  streetRight(ctx, SHAMBLER, { look: 'jogger' });
  setDarkness(ctx.world, 0.48, 600);

  // @2560: LOCK — the end of the street: the butcher (a brute) charges in, souls out of the
  // chimney and the drain, shamblers both ways; then on to the corner.
  yield ctx.waitCamera(OZ_A_ARENAS.end[0]);
  ctx.lockCamera(OZ_A_ARENAS.end[0], OZ_A_ARENAS.end[1]);
  const A3 = 'oz-a3';
  streetRight(ctx, SHAMBLER, { look: 'vendor' }, 16, A3);
  streetLeft(ctx, SHAMBLER, { look: 'student' }, 16, A3);
  chimneySoul(ctx, OZ_A_SPOTS.chimneys[2], A3);
  yield 90;
  streetRight(ctx, BRUTE, { look: 'butcher' }, 24, A3);
  yield 80;
  drainSoul(ctx, A3);
  streetRight(ctx, SHAMBLER, { look: 'shopper' }, 16, A3);
  yield 90;
  streetLeft(ctx, SHAMBLER, { look: 'pensioner' }, 16, A3);
  if (normalUp(ctx)) streetRight(ctx, GUNNER, { look: 'jogger' }, 16, A3);
  yield 60;
  yield () => ctx.world.countAlive(A3) <= 2;
  streetRight(ctx, SHAMBLER, { look: 'student' }, 16, A3);
  streetRight(ctx, SHAMBLER, { look: 'vendor' }, 36, A3);
  if (twoPlayers(ctx)) streetRight(ctx, SHAMBLER, { look: 'shopper' }, 56, A3);
  if (hardOnly(ctx)) streetLeft(ctx, BRUTE, { look: 'bouncer' }, 16, A3);
  yield* waitArena(ctx, A3);
  yield 20;
  ctx.unlockCamera();

  // The last stretch: two stragglers, then round the corner.
  yield 20;
  streetRight(ctx, SHAMBLER, { look: 'pensioner' });
  yield 50;
  streetRight(ctx, SHAMBLER, { look: 'jogger' });
  yield ctx.waitPlayerX(OZ_A_W - 64);
  yield ctx.exitTo(OZ_SECTION.b);
}
