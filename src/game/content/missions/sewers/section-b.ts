/**
 * sewers-b — DE STEEGJES, 01:00 (docs/design/sewers.md §2.2, §5.3): the alleys (0–1,280: dealers
 * from doorways, the gutter grates rattle once each, a pimp with his bodyguard, the sacked tourist),
 * the alley mouth (1,280–1,536), the square by the old church (1,536–2,560: the crooks idle there),
 * THE RAT ERUPTION (LOCK 1,920–2,304: three grates rattle and burst, the crooks flee, three waves
 * of runner rats, a leaper from the middle grate), then the big burst grate (2,384–2,448) opens:
 * `SPRING!`, the heroes jump in → sewers-c (transition `cut`). 2,560 px, scroll right. Wave P1b B.
 *
 * 2P: the grate waits up to `B_PLAY.follow` (120) ticks after the first hero reaches it for the
 * other living heroes, then opens the exit; the runner's exit takes the whole team (the second hero
 * is carried). Grey (Phase 4): P0's placeholder scenery; the grates are `sewers-grate` stand-ins.
 * Phase 6 (P6b B): the canal scene draws the kit's painting (`canal`; docs/api/canal.md §12); the
 * grates and their lids show the kit's canal sprites (`decor/sewers-grate/<kind>`, `<kind>-lid`,
 * top anchor), the decor rats keep their own art. The grey night, terrain style and grate
 * stand-in frames stay for `?canal=0`.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext, SectionDef } from '../../../mission/index';
import { ratPack } from '../../sewers/rats/index';
import { SewersGrate } from '../../sewers/set-pieces/grate';
import { streetFlee } from '../../sewers/street/index';
import { sewersCanal } from './canal/index';
import { at, crate, fromRight, hardOnly, hostage, normalUp, placeBanner, twoPlayers } from './helpers';
import { SEWERS_LOCALS, SEWERS_PIECE, SEWERS_RAT, SEWERS_SECTION, SEWERS_SONG, SEWERS_STREET } from './ids';
import { GREY_NIGHT, GREY_STREET } from './placeholder';
import { flatTerrain, G, SEWERS_B } from './terrain';

/** The way down: the big burst grate (enabled after the eruption lock, see `jumpIn`). */
export const SEWERS_B_EXIT = 'sewers-b-grate';

/** The play numbers of sewers-b (spec §2.2; *start* where the spec says so). */
export const B_PLAY = {
  /** The alley dealers in their doorways (3, one at a time). */
  doorways: [300, 470, 640] as readonly number[],
  crateR: 600,
  /** The pimp with his bodyguard. */
  pimp: 800,
  guard: 840,
  /** Hostage tourist 3 (bind sack, drop: the tourist's table). */
  tourist: 1000,
  /** The two later alley dealers. */
  alleyDealers: [1130, 1240] as readonly number[],
  /** The crooks that idle on the square (the eruption's victims-to-be). */
  squareDealers: [2130, 2236] as readonly number[],
  squarePimp: 2280,
  /** The eruption: the rattle (tell), then the waves. Runners per wave (NORMAL, 1P). */
  rattle: 60,
  waves: 3,
  perWave: 5,
  /**
   * A wave comes when the last is cleared (+ `clearGap`), never before `minGap`, at the latest after
   * `maxGap` (ticks): a quick squad clears the three waves in about 18 s, a slower one
   * in about 30 s (spec "over about 30 s" *start*).
   */
  minGap: 360,
  maxGap: 720,
  clearGap: 45,
  /** Ticks between two rats out of one grate. */
  every: 36,
  /** The lock holds at most this long after the last wave (then it opens anyway: never a softlock). */
  lastWave: 1500,
  /** 2P: after the first hero reaches the burst grate, the others have this long to follow. */
  follow: 120,
} as const;

/** The tag of the eruption's rats (the lock waits for them). */
const RATS_TAG = 'sewers-b-rats';

/** The gutter grates of the alleys (decor that rattles once each, spec §2.2). */
function gutters(ctx: SectionContext): void {
  for (const x of SEWERS_B.gutters) ctx.spawn(SEWERS_PIECE.grate, x, G, { kind: 'gutter', auto: true });
}

/** 0–1,280: three dealers from doorways, one at a time, the crate `R`. */
function* alleys(ctx: SectionContext): ScriptGen {
  crate(ctx, B_PLAY.crateR, 'R');
  const [d0, d1, d2] = B_PLAY.doorways;
  const first = at(ctx, SEWERS_STREET.dealer, d0, { lurk: true, facing: -1, look: 'a' }, 'ground', 'sewers-b-alley');
  yield () => first.dead || first.removed || ctx.camera.left >= d1 - 360;
  const second = at(ctx, SEWERS_STREET.dealer, d1, { lurk: true, facing: -1, look: 'b' }, 'ground', 'sewers-b-alley');
  yield () => second.dead || second.removed || ctx.camera.left >= d2 - 300;
  at(ctx, SEWERS_STREET.dealer, d2, { lurk: true, facing: -1, look: 'c' }, 'ground', 'sewers-b-alley');
}

/** 640–1,280: a pimp with a bodyguard, the sacked tourist, two dealers. */
function* backAlley(ctx: SectionContext): ScriptGen {
  yield ctx.waitCamera(640 - 384 + 120);
  at(ctx, SEWERS_STREET.pimp, B_PLAY.pimp, { whistle: false, facing: -1, look: 'b' }, 'ground', 'sewers-b-alley');
  at(ctx, SEWERS_STREET.bodyguard, B_PLAY.guard, { facing: -1, look: 'a' }, 'ground', 'sewers-b-alley');
  yield ctx.waitCamera(B_PLAY.tourist - 384 + 40);
  hostage(ctx, 'tourist', 'sack', B_PLAY.tourist, 'auto');
  yield ctx.waitCamera(B_PLAY.alleyDealers[0] - 384 + 24);
  at(ctx, SEWERS_STREET.dealer, B_PLAY.alleyDealers[0], { lurk: true, facing: -1 }, 'ground', 'sewers-b-alley');
  yield 50;
  fromRight(ctx, SEWERS_STREET.dealer, { look: 'a' }, 16, 'sewers-b-alley');
}

/** 1,280–1,920: the alley mouth (a rider crosses the square), the square: a fatbike youth, the idle crooks. */
function* square(ctx: SectionContext): ScriptGen {
  yield ctx.waitCamera(SEWERS_B.mouth[0] - 384 + 64);
  fromRight(ctx, SEWERS_LOCALS.rider);
  yield ctx.waitCamera(SEWERS_B.square[0] - 384);
  // The crooks idle on the square (they have not seen the heroes yet).
  at(ctx, SEWERS_STREET.dealer, B_PLAY.squareDealers[0], { lurk: true, facing: -1, look: 'c' }, 'ground', 'sewers-b-square');
  at(ctx, SEWERS_STREET.dealer, B_PLAY.squareDealers[1], { lurk: true, facing: 1, look: 'a' }, 'ground', 'sewers-b-square');
  at(ctx, SEWERS_STREET.pimp, B_PLAY.squarePimp, { facing: -1, look: 'a' }, 'ground', 'sewers-b-square');
  yield 40;
  fromRight(ctx, SEWERS_LOCALS.fatbike);
  if (twoPlayers(ctx)) {
    yield 90;
    fromRight(ctx, SEWERS_LOCALS.rider);
  }
}

/** Runners in one wave, by difficulty and co-op (NORMAL 1P: 5). */
function waveSize(ctx: SectionContext): number {
  return B_PLAY.perWave - (normalUp(ctx) ? 0 : 1) + (twoPlayers(ctx) ? 1 : 0) + (hardOnly(ctx) ? 1 : 0);
}

/** One wave: the runners shared over the three grates, one after the other out of each hole. */
function ratWave(ctx: SectionContext, grates: readonly SewersGrate[], n: number, wave: number): void {
  const per = [0, 0, 0];
  for (let i = 0; i < n; i++) per[(i + wave) % 3]++;
  for (let g = 0; g < 3; g++) {
    if (per[g] > 0) ratPack(ctx, per[g], { hole: grates[g].hole, every: B_PLAY.every, tag: RATS_TAG });
  }
}

/** Wait until the wave is cleared (+ a breath) but at least `minGap`, at most `maxGap` ticks. */
function* waveGap(ctx: SectionContext): ScriptGen {
  let t = 0;
  let clearAt = -1;
  yield () => {
    t++;
    if (clearAt < 0 && ctx.world.countAlive(RATS_TAG) === 0) clearAt = t;
    if (t >= B_PLAY.maxGap) return true;
    return t >= B_PLAY.minGap && clearAt >= 0 && t - clearAt >= B_PLAY.clearGap;
  };
}

/**
 * LOCK 1,920–2,304: THE RAT ERUPTION (spec §2.2, §5.3). The three grates rattle (60 ticks), burst;
 * the crooks left alive scream and run off (untargetable, no score: `streetFlee`); three waves of
 * runners out of the holes, a leaper lurking in the middle grate in the last wave.
 */
function* eruption(ctx: SectionContext, grates: readonly SewersGrate[]): ScriptGen {
  const [x0, x1] = SEWERS_B.lock;
  yield ctx.waitCamera(x0 - 8);
  ctx.lockCamera(x0, x1);
  for (const g of grates) g.rattle(B_PLAY.rattle);
  yield B_PLAY.rattle;
  for (let i = 0; i < grates.length; i++) grates[i].burst({ lidDir: i === 0 ? -1 : 1 });
  streetFlee(ctx.world);
  const n = waveSize(ctx);
  for (let w = 0; w < B_PLAY.waves; w++) {
    if (w > 0) yield* waveGap(ctx);
    ratWave(ctx, grates, n, w);
    if (w === B_PLAY.waves - 1) {
      // The leaper waits in the middle grate (the burst hole) and pounces once (P1a RATS: entry grate).
      ctx.spawn(SEWERS_RAT.leaper, grates[1].x, G, { entry: 'grate', delay: n * B_PLAY.every, tag: RATS_TAG });
    }
  }
  let t = 0;
  yield () => ++t >= B_PLAY.lastWave || ctx.world.countAlive(RATS_TAG) === 0;
  yield 30;
  ctx.unlockCamera();
  ctx.setCheckpoint();
}

/** Is any player in play with the feet over the burst grate (or past it)? */
function heroAtGrate(ctx: SectionContext): boolean {
  for (const p of ctx.players) if (p.alive && (p.state === 'play' || p.state === 'mounted') && p.x >= SEWERS_B.burst[0]) return true;
  return false;
}

/** Are all living heroes at the burst grate or past it? */
function allAtGrate(ctx: SectionContext): boolean {
  for (const p of ctx.players) {
    if (!p.alive || p.state === 'out' || p.state === 'dead') continue;
    if (p.x < SEWERS_B.burst[0] - 8) return false;
  }
  return true;
}

/**
 * After the lock: the big burst grate is open (rats still pour out as decor), the pointer `SPRING!`;
 * the exit opens when every living hero has reached it, or `follow` ticks after the first did (2P:
 * the runner's exit then carries the second hero along).
 */
function* jumpIn(ctx: SectionContext, big: SewersGrate): ScriptGen {
  big.burst({ pour: true, lidDir: 1 });
  ctx.hud.pointer(big, 'SPRING!', { dy: 8 });
  yield () => heroAtGrate(ctx);
  let t = 0;
  yield () => ++t >= B_PLAY.follow || allAtGrate(ctx);
  ctx.enableExit(SEWERS_B_EXIT);
}

export function* scriptB(ctx: SectionContext): ScriptGen {
  placeBanner(ctx, SEWERS_SECTION.b);
  gutters(ctx);
  const grates = SEWERS_B.grates.map((x) => ctx.spawn(SEWERS_PIECE.grate, x, G, { kind: 'eruption' }) as SewersGrate);
  const big = ctx.spawn(SEWERS_PIECE.grate, (SEWERS_B.burst[0] + SEWERS_B.burst[1]) / 2, G, { kind: 'big' }) as SewersGrate;
  ctx.world.scripts.run(alleys(ctx), { name: 'sewers-b alleys' });
  ctx.world.scripts.run(backAlley(ctx), { name: 'sewers-b back alley' });
  yield ctx.waitCamera(SEWERS_B.mouth[0] - 384);
  yield* square(ctx);
  yield* eruption(ctx, grates);
  yield* jumpIn(ctx, big);
}

export const sectionB: SectionDef = {
  id: SEWERS_SECTION.b,
  name: 'De Steegjes',
  width: SEWERS_B.w,
  height: 216,
  scroll: 'right',
  background: GREY_NIGHT,
  terrain: flatTerrain(SEWERS_SECTION.b),
  terrainStyle: GREY_STREET,
  // The painted alleys and square (P6b): the grey night and street draw only with `?canal=0`.
  canal: sewersCanal(SEWERS_SECTION.b),
  playerStart: { x: 48, y: G },
  checkpoints: [...SEWERS_B.checkpoints],
  music: SEWERS_SONG.street,
  ambience: 'sewers/rain-bed',
  art: [
    'enemy/delivery-rider',
    'enemy/fatbike-youth',
    'enemy/sewers-dealer',
    'enemy/sewers-pimp',
    'enemy/sewers-bodyguard',
    'enemy/sewers-rat-runner',
    'enemy/sewers-rat-leaper',
    'decor/sewers-grate',
  ],
  exits: [
    {
      id: SEWERS_B_EXIT,
      rect: { x: SEWERS_B.burst[0], y: 0, w: SEWERS_B.burst[1] - SEWERS_B.burst[0], h: 216 },
      to: SEWERS_SECTION.c,
      transition: 'cut',
      disabled: true,
    },
  ],
  script: scriptB,
};
