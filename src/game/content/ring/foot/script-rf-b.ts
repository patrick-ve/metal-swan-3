/**
 * `rf-b` DE BLOKKADE — the script (docs/design/ring.md §R.6, §R.7; GDD 1.5 pacing: never more than
 * 4 s without an enemy on screen, except the scenes; GDD 4.11 fairness). About 1:30 at a human pace
 * before the boat.
 *
 * The first screen: the police van and the tape with two officers (never targets), the head of the
 * queue; two `loper`s run in with banners and sit down. Then the blockade: glued `lijmer`s, `ketting`s
 * chained to the painted barrels, a `megafoon` on a crate; LOCK 1 at the first barrels; the lunch
 * table; LOCK 2 under the big spandoek; LOCK 3 at the last barrels; the arena: the pink boat `DE
 * LAATSTE DRUPPEL` (startBoat; the arena locks; a body wall at the trailer's drawbar), its end (the
 * leader carried off), the exit past the wreck → MISSION COMPLETE (the one tally of the level).
 * NORMAL / HARD add activists (`N`, `H`); 2P adds one per fight. A pacing guard (`RF_B_TRICKLE`) sends
 * a loper in when nobody of the blockade has been in view for a while.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { Boss } from '../../../boss';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { ACTIVIST, KETTING_REACH, POLICE } from '../activists/api';
import { BOAT_ID, isRingBoat, startBoat, waitBoatEnd } from '../boot/api';
import { WALL_X } from '../boot/geometry';
import { RF_GROUND } from './ids';
import { RF_B_ARENA_L, RF_B_ARENA_R, RF_B_ARENAS, RF_B_BARRELS, RF_B_BOAT_X, RF_B_CRATES, RF_B_POLICE_X, RF_B_W } from './layout-rf-b';
import { BANNERS } from './lines';
import { spawnBlokScene } from './scene-rf-b';

/** Tags of the section's groups (the boat's own lopers: boot/boat.ts `BOAT_LOPER_TAG`). */
export const RF_B_TAG = { zone: 'rf-b-zone', lock: 'rf-b-lock', first: 'rf-b1', spandoek: 'rf-b2', last: 'rf-b3' } as const;

/** A lock's wave lasts at least this long (the lopers run in and sit down; the bot clears a wave in a blink). */
export const RF_B_WAVE_MIN = 150;

/** The pacing guard (GDD 1.5): after this many ticks with no enemy in view, a loper runs in. */
export const RF_B_TRICKLE = 100;

const L = ACTIVIST.lijmer;
const K = ACTIVIST.ketting;
const M = ACTIVIST.megafoon;
const P = ACTIVIST.loper;

const sign = (i: number): string => BANNERS[i % BANNERS.length];

function normalUp(ctx: SectionContext): boolean {
  return ctx.session.difficulty !== 'easy';
}

function hard(ctx: SectionContext): boolean {
  return ctx.session.difficulty === 'hard';
}

function withTag(p: SpawnParams | undefined, tag?: string): SpawnParams {
  return tag ? { ...p, tag } : (p ?? {});
}

/** A loper runs in from the right edge and sits `ahead` px inside the view. */
function runIn(ctx: SectionContext, tag?: string, ahead = 70, p?: SpawnParams, margin = 16): Entity {
  const x = Math.min(RF_B_ARENA_L - 8, ctx.camera.right + margin);
  return ctx.spawn(P, x, RF_GROUND, { facing: -1, enter: 'right', sitAt: Math.max(ctx.camera.x + 60, ctx.camera.right - ahead), ...withTag(p, tag) });
}

/** A loper runs in from the left edge (behind the squad) and sits `ahead` px inside the view. */
function runInLeft(ctx: SectionContext, tag?: string, ahead = 70, p?: SpawnParams): Entity {
  const x = Math.max(8, ctx.camera.x - 16);
  return ctx.spawn(P, x, RF_GROUND, { facing: 1, enter: 'left', sitAt: ctx.camera.x + ahead, ...withTag(p, tag) });
}

/** A `ketting` chained to the painted barrel at `barrelX` (layout `RF_B_BARRELS`; it sits on the barrel's left). */
const PAINTED: SpawnParams = { anchor: 'barrel', barrel: 'layout' };
function chainedTo(barrelX: number): number {
  if (!RF_B_BARRELS.some(([x]) => x === barrelX)) throw new Error(`rf-b: no painted barrel at ${barrelX}`);
  return barrelX - KETTING_REACH;
}

/** An activist that stands (or sits) at x (lijmer, ketting, megafoon). */
function at(ctx: SectionContext, id: string, x: number, tag?: string, p?: SpawnParams): Entity {
  return ctx.spawn(id, x, RF_GROUND, { facing: -1, ...withTag(p, tag) });
}

/** A camera lock: each wave comes when the last is down to one (or after 6 s); then the unlock. */
function* fight(ctx: SectionContext, at0: readonly [number, number], tag: string, waves: Array<(ctx: SectionContext) => void>, max = 2400): ScriptGen {
  yield ctx.waitCamera(at0[0]);
  ctx.lockCamera(at0[0], at0[1]);
  for (let i = 0; i < waves.length; i++) {
    waves[i](ctx);
    const t0 = ctx.world.tick;
    const last = i === waves.length - 1;
    // The next wave comes when this one is down to one (never before `RF_B_WAVE_MIN`), or after 6 s.
    yield () => (ctx.world.tick - t0 >= RF_B_WAVE_MIN && ctx.world.countAlive(tag) <= (last ? 0 : 1)) || ctx.world.tick - t0 > (last ? max : 360);
  }
  yield 20;
  ctx.unlockCamera();
}

/** The pacing guard's next try when its loper was shot down before anyone saw it (ticks). */
export const RF_B_TRICKLE_RETRY = 30;
/** The most lopers the pacing guard sends in one run of rf-b (a safety cap). */
export const RF_B_TRICKLE_MAX = 40;

/**
 * A background script for the blockade: whenever no enemy has been in view for `RF_B_TRICKLE` ticks
 * (before the arena; in a lock too, while its last wave runs out), a loper runs in from the RIGHT,
 * just inside the view's edge, ahead of the squad. Only when that one was shot down before anyone
 * saw it (a stream of bullets across the view, two guns in 2P) does the next try, `RF_B_TRICKLE_RETRY`
 * ticks later, come from the left edge (behind the squad); so do the tries on the run-up to the boat,
 * where the right edge is already past the arena's line. At most `RF_B_TRICKLE_MAX` in all.
 */
function trickle(ctx: SectionContext): void {
  ctx.world.scripts.run(
    function* rfBTrickle(): ScriptGen {
      let quiet = 0;
      let n = 0;
      let last: Entity | null = null;
      let lastSeen = true;
      for (;;) {
        yield 1;
        const w = ctx.world;
        if (ctx.camera.x >= RF_B_ARENA_L - 48 || n >= RF_B_TRICKLE_MAX) return;
        // An enemy that can be shot (a beaten activist running off, or one carried away, does not count).
        const list = w.byTag('shootable');
        let seen = false;
        for (let i = 0; i < list.length && !seen; i++) {
          const e = list[i];
          if (e.alive && e.team === 'enemy' && w.onScreen(e, 0)) seen = true;
        }
        if (last && !lastSeen && last.alive && w.onScreen(last, 0)) lastSeen = true;
        quiet = seen ? 0 : quiet + 1;
        if (quiet >= RF_B_TRICKLE) {
          // Seen, the count starts again from 0; shot down unseen, the next try comes sooner.
          quiet = RF_B_TRICKLE - RF_B_TRICKLE_RETRY;
          // Near the arena the right edge is past the boat's line: then from the left as well.
          const behind: boolean = (last !== null && !lastSeen) || ctx.camera.right - 12 > RF_B_ARENA_L - 8;
          const sit = 70 + (n % 3) * 24;
          const x = ctx.camera.x + 10;
          last = behind
            ? ctx.spawn(P, x, RF_GROUND, { facing: 1, enter: 'left', sitAt: x + sit - 20, sign: sign(n + 1) })
            : runIn(ctx, undefined, sit, { sign: sign(n + 1) }, -12);
          lastSeen = behind;
          n++;
        }
      }
    },
    { name: 'rf-b trickle' },
  );
}

function* blockade(ctx: SectionContext): ScriptGen {
  const N = normalUp(ctx);
  const H = hard(ctx);
  const P2 = ctx.playerCount >= 2;
  const T = RF_B_TAG;
  trickle(ctx);
  for (const [x, contains] of RF_B_CRATES) ctx.spawn('crate', x, 'ground', { contains });

  // @0 THE POLICE LINE: two officers by the tape; two lopers run in with banners and sit down.
  ctx.showGo();
  yield 40;
  runIn(ctx, T.zone, 120, { sign: sign(0) });
  yield 50;
  runIn(ctx, T.zone, 60, { sign: sign(3) });
  yield ctx.waitCamera(150);
  at(ctx, L, 712, T.zone, { sign: sign(1) });
  at(ctx, K, chainedTo(640), T.zone, PAINTED);
  yield ctx.waitCamera(260);
  at(ctx, M, 812, T.zone);
  if (N) at(ctx, L, 760, T.zone, { sign: sign(2) });
  if (P2) runIn(ctx, T.zone, 90);

  // LOCK 1 (@560): the first barrels; lopers from both sides, a chained pair.
  yield* fight(ctx, RF_B_ARENAS.first, T.first, [
    (c) => {
      runIn(c, T.first, 60, { sign: sign(0) });
      runIn(c, T.first, 110, undefined, 44);
      at(c, K, 884, T.first, { anchor: 'partner' });
    },
    (c) => {
      runInLeft(c, T.first, 60);
      runIn(c, T.first, 80, { sign: sign(3) });
      if (N) at(c, M, 912, T.first);
      if (P2) at(c, L, 860, T.first, { sign: sign(2) });
      if (H) at(c, K, 900, T.first, { anchor: 'barrel' });
    },
    (c) => {
      runIn(c, T.first, 70, { sign: sign(1) });
      runIn(c, T.first, 130, undefined, 40);
      runInLeft(c, T.first, 90, { sign: sign(2) });
    },
  ]);

  // The lunch table and the second barrels: glued sitters, a chained one, a megaphone.
  yield 30;
  runIn(ctx, undefined, 70);
  yield ctx.waitCamera(760);
  at(ctx, L, 1104, undefined, { sign: sign(2) });
  runIn(ctx, undefined, 90);
  yield ctx.waitCamera(880);
  at(ctx, K, chainedTo(1176), undefined, PAINTED);
  if (N) runIn(ctx, undefined, 60, { sign: sign(1) });
  yield ctx.waitCamera(1000);
  at(ctx, M, 1300);
  at(ctx, L, 1392, undefined, { sign: sign(3) });
  yield ctx.waitCamera(1150);
  runIn(ctx, undefined, 70);
  runIn(ctx, undefined, 120, { sign: sign(0) }, 40);
  at(ctx, K, chainedTo(1512), undefined, PAINTED);
  yield ctx.waitCamera(1350);
  at(ctx, L, 1640, undefined, { sign: sign(1) });
  if (N) runIn(ctx, undefined, 80);

  // LOCK 2 (@1716): under the big spandoek.
  yield* fight(ctx, RF_B_ARENAS.spandoek, T.spandoek, [
    (c) => {
      at(c, M, 1954, T.spandoek);
      at(c, L, 2010, T.spandoek, { sign: sign(0) });
      runIn(c, T.spandoek, 70);
    },
    (c) => {
      runIn(c, T.spandoek, 60, { sign: sign(3) });
      runIn(c, T.spandoek, 100, undefined, 30);
      runIn(c, T.spandoek, 140, { sign: sign(1) }, 46);
      if (N) runInLeft(c, T.spandoek, 70);
    },
    (c) => {
      at(c, K, 2036, T.spandoek, { anchor: 'partner' });
      at(c, K, 2056, T.spandoek, { anchor: 'partner' });
      runIn(c, T.spandoek, 80);
      if (P2) runInLeft(c, T.spandoek, 60);
      if (H) at(c, M, 2070, T.spandoek);
    },
    (c) => {
      runIn(c, T.spandoek, 60, { sign: sign(2) });
      runIn(c, T.spandoek, 110, undefined, 36);
      runInLeft(c, T.spandoek, 80, { sign: sign(0) });
      if (N) runIn(c, T.spandoek, 150, undefined, 60);
    },
  ]);

  // The crowd's middle: more barrels, a megaphone, glued rows.
  yield 30;
  runIn(ctx, undefined, 80, { sign: sign(2) });
  yield ctx.waitCamera(1960);
  at(ctx, L, 2236, undefined, { sign: sign(0) });
  runIn(ctx, undefined, 60);
  yield ctx.waitCamera(2100);
  at(ctx, K, chainedTo(2436), undefined, PAINTED);
  if (N) at(ctx, L, 2330, undefined, { sign: sign(3) });
  yield ctx.waitCamera(2250);
  at(ctx, M, 2580);
  runIn(ctx, undefined, 80);
  yield ctx.waitCamera(2420);
  runIn(ctx, undefined, 60, { sign: sign(1) });
  runIn(ctx, undefined, 110, undefined, 40);
  yield ctx.waitCamera(2560);
  at(ctx, L, 2700, undefined, { sign: sign(2) });

  // LOCK 3 (@2760): the last barrels before the boat.
  yield* fight(ctx, RF_B_ARENAS.last, T.last, [
    (c) => {
      at(c, K, chainedTo(2918), T.last, PAINTED);
      at(c, L, 3010, T.last, { sign: sign(3) });
      runIn(c, T.last, 70);
    },
    (c) => {
      at(c, M, 3090, T.last);
      runInLeft(c, T.last, 60);
      runIn(c, T.last, 90, { sign: sign(0) });
      if (N) at(c, K, 3050, T.last, { anchor: 'partner' });
    },
    (c) => {
      runIn(c, T.last, 60);
      runIn(c, T.last, 100, { sign: sign(2) }, 30);
      runIn(c, T.last, 140, undefined, 46);
      if (P2) runInLeft(c, T.last, 80);
      if (H) at(c, L, 3070, T.last, { sign: sign(1) });
    },
    (c) => {
      at(c, M, 3110, T.last);
      runIn(c, T.last, 80, { sign: sign(3) });
      runInLeft(c, T.last, 70);
    },
  ]);

  // The run to the boat: the last lopers; the pink boat comes into view.
  yield 30;
  runIn(ctx, undefined, 70);
  yield ctx.waitCamera(2980);
  at(ctx, L, 3300, undefined, { sign: sign(1) });
  runIn(ctx, undefined, 100);
  yield ctx.waitCamera(3120);
  runIn(ctx, undefined, 60, { sign: sign(3) });
  if (N) runIn(ctx, undefined, 110, undefined, 40);
}

export function* scriptRfB(ctx: SectionContext): ScriptGen {
  spawnBlokScene(ctx.world);
  // The police line: two officers stand by the tape (never targets).
  ctx.spawn(POLICE, RF_B_POLICE_X, RF_GROUND, { facing: 1 });
  ctx.spawn(POLICE, RF_B_POLICE_X + 82, RF_GROUND, { facing: -1 });
  if (!ctx.bossRush) yield* blockade(ctx);

  // THE BOAT's arena (the last screen).
  yield ctx.waitCamera(RF_B_ARENA_L - 8);
  ctx.lockCamera(RF_B_ARENA_L, RF_B_ARENA_R);
  ctx.setCheckpoint(RF_B_ARENA_L + 40);
  const boat = ctx.spawn(BOAT_ID, RF_B_BOAT_X, RF_GROUND) as Boss;
  // Nobody walks through the trailer: a body wall at its drawbar.
  const wall = ctx.bodyWall(RF_B_BOAT_X + WALL_X, { vehicles: false });
  yield 30;
  yield startBoat(ctx, boat);
  if (isRingBoat(boat)) yield waitBoatEnd(boat);
  else yield () => boat.defeated || boat.removed;
  // The exit: past the wreck to the road beyond (the blockade is broken).
  wall.remove();
  ctx.showGo();
  const t0 = ctx.world.tick;
  yield () => ctx.players.some((p) => p.alive && p.x >= RF_B_W - 120) || ctx.world.tick - t0 > 90;
  yield ctx.missionComplete();
}
