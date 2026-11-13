/**
 * sewers-a — DE WALLEN, 23:00 (docs/design/sewers.md §2.1, §4.1; wave P1b A): the quay of the
 * Oudezijds Achterburgwal by night, 3,072 px, scroll right; two locks; GOUDEN GERRIT's limo at the
 * bridge head; then → sewers-b.
 *
 * | x (camera right edge) | content |
 * |---|---|
 * | 0–640 | walk-in; crate `H` at 420 (the first weapon); dealers step out from behind the krul at 300 and the tree at 520 (the dealer lesson) |
 * | 640–1,280 | 3 dealers; the pimp lesson at 900 (he whistles one bodyguard in); a fatbike youth at 1,100; the banana tourist at 1,150 (chair); checkpoint 1,200 |
 * | 1,280–1,536 | bridge 1 (vista); delivery riders both ways |
 * | 1,664–2,048 | LOCK 1: two waves (2 pimps, 2 bodyguards, 3 dealers); crate `S` at 1,800; after it the plain tourist at 2,200 (cage, `pickup-food`); checkpoint 2,300 |
 * | 2,304–2,688 | a delivery rider, a dealer behind the krul at 2,450, a fatbike pair at 2,500, a dealer |
 * | 2,688–3,072 | LOCK: GOUDEN GERRIT (`sewers-gerrit`, `bossIntro`, the song `sewers-gerrit`); crate `R` at 2,720; he flees; unlock; exit → sewers-b at 3,040 |
 *
 * `?mission=sewers&section=sewers-a&boss=1` starts at `bossStart` (2,700) and runs the arena only.
 * Phase 6 (wave P6b A): the canal scene (`canal`, the kit's sw_a.py) paints the quay, the krul, the
 * elm and both bridges; the grey stand-ins (a-kit.ts) and P0's placeholder draw only with
 * `?canal=0`. The limo and Gerrit are figures (bosses/sewers-gerrit/art.ts), never scenery.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { GerritLimo } from '../../bosses/sewers-gerrit/limo';
import { GERRIT_ID, GERRIT_NAME } from '../../bosses/sewers-gerrit/numbers';
import { streetFlee } from '../../sewers/street/person';
import { aDecor, A_DECOR_ART } from './a-kit';
import { sewersCanal } from './canal/index';
import { at, crate, fromLeft, fromRight, hardOnly, hostage, normalUp, placeBanner, prewarm, VIEW_W } from './helpers';
import { SEWERS_LOCALS, SEWERS_SECTION, SEWERS_SONG, SEWERS_STREET } from './ids';
import { GREY_NIGHT, GREY_STREET } from './placeholder';
import { flatTerrain, G, SEWERS_A } from './terrain';

/** The end exit (enabled after the mini-boss). */
export const SEWERS_A_EXIT = 'sewers-a-end';

/** Tags of the waves (the locks wait on them). */
export const A_TAG = {
  quay: 'sewers-a-quay',
  lock1: 'sewers-a-lock1',
  lock1b: 'sewers-a-lock1b',
  limo: 'sewers-a-limo',
} as const;

const DEALER = SEWERS_STREET.dealer;
const PIMP = SEWERS_STREET.pimp;
const GUARD = SEWERS_STREET.bodyguard;
const RIDER = SEWERS_LOCALS.rider;
const FATBIKE = SEWERS_LOCALS.fatbike;

/** Wait until the camera's right edge reaches x (the spec's trigger column). */
function right(ctx: SectionContext, x: number): ReturnType<SectionContext['waitCamera']> {
  return ctx.waitCamera(Math.max(0, x - VIEW_W));
}

/** GOUDEN GERRIT's limo across the quay at the bridge head (it waits for the arena). */
function spawnLimo(ctx: SectionContext): Entity {
  return ctx.spawn(GERRIT_ID, SEWERS_A.limoX, 'ground', { facing: -1 });
}

/**
 * LOCK 2: GOUDEN GERRIT. The arena locks, the crate `R`, the WARNING banner and his song; he fights
 * until the limo is a wreck and he flees; his bodyguards run off; the street song again; unlock, GO,
 * the exit behind the wreck opens.
 */
export function* gerritArena(ctx: SectionContext, limo: Entity): ScriptGen {
  const [x0, x1] = SEWERS_A.arena;
  yield ctx.waitCamera(x0);
  ctx.lockCamera(x0, x1);
  crate(ctx, SEWERS_A.crates.R, 'R');
  if (limo instanceof GerritLimo) {
    limo.start();
    yield ctx.bossIntro(GERRIT_NAME, { subtitle: 'MINI-BOSS', music: SEWERS_SONG.gerrit });
    yield () => limo.defeated;
  } else if (limo instanceof Boss) {
    yield () => limo.defeated;
  } else yield 120;
  // His bodyguards (and anyone left on the quay) run off after him.
  streetFlee(ctx.world);
  yield 40;
  ctx.music(SEWERS_SONG.street, 90);
  ctx.unlockCamera(false);
  ctx.enableExit(SEWERS_A_EXIT);
  ctx.showGo();
}

/** LOCK 1 (1,664–2,048): two waves from both sides; crate `S`. */
function* lockOne(ctx: SectionContext): ScriptGen {
  const [x0, x1] = SEWERS_A.lock1;
  yield ctx.waitCamera(x0);
  ctx.lockCamera(x0, x1);
  crate(ctx, SEWERS_A.crates.S, 'S');
  // Wave 1: a pimp (no whistle: the wave brings its own bodyguard), a bodyguard, two dealers.
  fromRight(ctx, PIMP, { whistle: false, look: 'b' }, 16, A_TAG.lock1);
  yield 30;
  fromLeft(ctx, GUARD, { look: 'a' }, 16, A_TAG.lock1);
  yield 40;
  fromRight(ctx, DEALER, { look: 'a' }, 16, A_TAG.lock1);
  if (normalUp(ctx)) {
    yield 50;
    fromLeft(ctx, DEALER, { look: 'c' }, 16, A_TAG.lock1);
  }
  yield () => ctx.world.countAlive(A_TAG.lock1) <= 1;
  // Wave 2: the second pimp, the second bodyguard, the third dealer (EASY: it came here).
  yield 30;
  fromRight(ctx, GUARD, { look: 'b' }, 16, A_TAG.lock1b);
  yield 40;
  fromLeft(ctx, PIMP, { whistle: false, look: 'a' }, 16, A_TAG.lock1b);
  yield 40;
  fromRight(ctx, DEALER, { look: 'b' }, 16, A_TAG.lock1b);
  if (!normalUp(ctx)) {
    yield 40;
    fromLeft(ctx, DEALER, { look: 'c' }, 16, A_TAG.lock1b);
  }
  if (hardOnly(ctx)) {
    yield 60;
    fromLeft(ctx, DEALER, { look: 'a' }, 16, A_TAG.lock1b);
  }
  yield () => ctx.world.countAlive(A_TAG.lock1) === 0 && ctx.world.countAlive(A_TAG.lock1b) === 0;
  yield 30;
  ctx.unlockCamera();
}

export function* scriptA(ctx: SectionContext): ScriptGen {
  prewarm('enemy/sewers-dealer', 'enemy/sewers-pimp', 'enemy/sewers-bodyguard', 'boss/sewers-gerrit', A_DECOR_ART);
  if (ctx.bossRush) {
    yield* gerritArena(ctx, spawnLimo(ctx));
    return;
  }
  // The place and the clock after the mission's MISSION 2 / START! banner.
  ctx.world.scripts.run(
    function* sewersABanner(): ScriptGen {
      yield 150;
      placeBanner(ctx, SEWERS_SECTION.a);
    },
    { name: 'sewers-a banner' },
  );

  // 0–640: the first weapon; two dealers step out from behind the krul and the tree (the dealer lesson).
  crate(ctx, SEWERS_A.crates.H, 'H');
  at(ctx, DEALER, SEWERS_A.krul[0] + 6, { lurk: true, facing: -1, look: 'a' }, 'ground', A_TAG.quay);
  at(ctx, DEALER, SEWERS_A.tree + 6, { lurk: true, facing: -1, look: 'b' }, 'ground', A_TAG.quay);

  // [N] a delivery rider once the first weapon is in hand (the 4-second rule on the walk-in).
  if (normalUp(ctx)) {
    yield right(ctx, 470);
    fromRight(ctx, RIDER, { from: 'right' });
  }

  // 640–1,280: three dealers, the pimp lesson at 900, a fatbike youth, the banana tourist.
  yield right(ctx, 640);
  fromRight(ctx, DEALER, { look: 'c' }, 16, A_TAG.quay);
  hostage(ctx, 'tourist', 'chair', SEWERS_A.hostages[0], 'auto', 'ground', { look: 'banana' });
  yield right(ctx, 900);
  // The pimp lesson: he struts in, whistles one bodyguard in, then the gold pistol.
  fromRight(ctx, PIMP, { look: 'a' }, 16, A_TAG.quay);
  yield right(ctx, 1000);
  fromRight(ctx, DEALER, { look: 'a' }, 16, A_TAG.quay);
  yield right(ctx, 1100);
  fromRight(ctx, FATBIKE, undefined, 16, A_TAG.quay);
  yield right(ctx, 1240);
  fromLeft(ctx, DEALER, { look: 'b' }, 16, A_TAG.quay);

  // 1,280–1,536: bridge 1 (vista); delivery riders both ways.
  yield right(ctx, 1340);
  fromRight(ctx, RIDER, { from: 'right' });
  yield 70;
  ctx.spawn(RIDER, 0, 'ground', { from: 'behind' });
  if (normalUp(ctx)) {
    yield right(ctx, 1480);
    fromRight(ctx, FATBIKE, undefined, 16, A_TAG.quay);
    yield right(ctx, 1600);
    fromRight(ctx, DEALER, { look: 'c' }, 16, A_TAG.quay);
  }

  // LOCK 1, then the plain tourist in his cage.
  yield* lockOne(ctx);
  hostage(ctx, 'tourist', 'cage', SEWERS_A.hostages[1], 'pickup-food');
  if (normalUp(ctx)) {
    yield right(ctx, 2160);
    fromRight(ctx, DEALER, { look: 'b' }, 16, A_TAG.quay);
  }

  // 2,304–2,688: a rider, a dealer behind the second krul, a fatbike pair, a dealer; the limo waits.
  yield right(ctx, 2320);
  fromRight(ctx, RIDER, { from: 'right' });
  at(ctx, DEALER, SEWERS_A.krul[1] + 6, { lurk: true, facing: -1, look: 'c' }, 'ground', A_TAG.limo);
  yield right(ctx, 2500);
  fromRight(ctx, FATBIKE, { pair: true }, 16, A_TAG.limo);
  const limo = spawnLimo(ctx);
  yield right(ctx, 2620);
  fromRight(ctx, DEALER, { look: 'a' }, 16, A_TAG.limo);
  if (hardOnly(ctx)) {
    yield 60;
    ctx.spawn(RIDER, 0, 'ground', { from: 'behind' });
  }

  // LOCK 2: GOUDEN GERRIT.
  yield* gerritArena(ctx, limo);
}

export const sectionA: SectionDef = {
  id: SEWERS_SECTION.a,
  name: 'De Wallen',
  width: SEWERS_A.w,
  height: 216,
  scroll: 'right',
  background: GREY_NIGHT,
  // Phase 6 (wave P6b A): the kit's baked scene (sw_a.py; docs/api/canal.md §12). The grey night, the
  // street style and the a-kit stand-ins (krul, tree, the limo's bridge: all `decor`) stay for
  // `?canal=0`; with the scene on none of them is built or drawn.
  canal: sewersCanal(SEWERS_SECTION.a),
  terrain: flatTerrain(SEWERS_SECTION.a),
  terrainStyle: GREY_STREET,
  decor: aDecor(),
  playerStart: { x: 48, y: G },
  bossStart: { x: SEWERS_A.bossX, y: G },
  checkpoints: [...SEWERS_A.checkpoints],
  music: SEWERS_SONG.street,
  ambience: 'sewers/rain-bed',
  art: [
    'enemy/delivery-rider',
    'enemy/fatbike-youth',
    'enemy/sewers-dealer',
    'enemy/sewers-pimp',
    'enemy/sewers-bodyguard',
    'item/sewers-mints',
    'item/hostage/tourist',
    'boss/sewers-gerrit',
    A_DECOR_ART,
  ],
  exits: [{ id: SEWERS_A_EXIT, rect: { x: SEWERS_A.exitX, y: 0, w: SEWERS_A.w - SEWERS_A.exitX, h: 216 }, to: SEWERS_SECTION.b, disabled: true }],
  script: scriptA,
};
