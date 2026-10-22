/**
 * `rf-a` DE FILE — the script (docs/design/ring.md §R.5; GDD 1.5 pacing: never more than 4 s
 * without an enemy on screen, except the scenes; GDD 4.11 fairness). About 1:15 at a human pace.
 *
 * The first screen: the parked wagons with their drivers at the wheel (silent), the queue ahead,
 * two riders who dumped their scooters walk up. Then the courier's NIET THUIS gag at the estate,
 * the first lock (riders, a courier on the van's roof, the crew), the box truck and the camper
 * (couriers lob parcels from the roofs), the second lock at the gang's parcel van with the tied
 * hostage (the crew guards it), the coach (two couriers on its roof), the last lock, the run to
 * the police line → `rf-b`. NORMAL / HARD add members (`[N]`, `[H]`); 2P adds one per fight.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import type { SectionContext } from '../../../mission/index';
import type { SpawnParams } from '../../../registry';
import { FOOT_GANG, GANG_ART } from './gangs/index';
import { RF_GROUND } from './ids';
import { CAR_Y, RF_A_ARENAS, RF_A_CRATES, RF_A_HOSTAGE_X, RF_A_W } from './layout-rf-a';
import { spawnJamScene } from './props';

/** The gangs' art prefixes (rf-a's tier-4 list). */
export const RF_A_FOES: readonly string[] = [`${GANG_ART.riderA}/`, `${GANG_ART.riderB}/`, `${GANG_ART.courier}/`, `${GANG_ART.crew}/`];

const R = FOOT_GANG.rider;
const C = FOOT_GANG.courier;
const K = FOOT_GANG.crew;

/** Roof lines (feet y) of the vehicles enemies stand on (layout-rf-a.ts; the drive's geometry). */
const ROOF = { van: CAR_Y - 40, boxTruck: CAR_Y - 50, camper: CAR_Y - 46, bus: CAR_Y - 58 } as const;

function normalUp(ctx: SectionContext): boolean {
  return ctx.session.difficulty !== 'easy';
}

function hard(ctx: SectionContext): boolean {
  return ctx.session.difficulty === 'hard';
}

function withTag(p: SpawnParams | undefined, tag?: string): SpawnParams {
  return tag ? { ...p, tag } : (p ?? {});
}

/** In from the right edge (never past the section's end). */
function right(ctx: SectionContext, id: string, tag?: string, p?: SpawnParams, margin = 16): Entity {
  const x = Math.min(RF_A_W - 8, ctx.camera.right + margin);
  return ctx.spawn(id, x, RF_GROUND, { facing: -1, enter: 'right', ...withTag(p, tag) });
}

/** In from the left edge. */
function left(ctx: SectionContext, id: string, tag?: string, p?: SpawnParams, margin = 16): Entity {
  const x = Math.max(8, ctx.camera.x - margin);
  return ctx.spawn(id, x, RF_GROUND, { facing: 1, enter: 'left', ...withTag(p, tag) });
}

/** Standing at x on a roof (feet y). */
function on(ctx: SectionContext, id: string, x: number, y: number, tag?: string, p?: SpawnParams): Entity {
  return ctx.spawn(id, x, y, { facing: -1, ...withTag(p, tag) });
}

/**
 * A lock's last wave ends the lock after this many ticks even if a member is still up (integrator,
 * wave B: was 2,400; gang members on roofs and blocks out of a level shot's reach held a lock up to 40 s:
 * rf-a 5,900–8,300 ticks on normal). The member stays and fights on after the unlock.
 */
export const RF_A_LOCK_MAX = 600;

/** A camera lock: wait until the tag is clear (members that ran off do not count), at most `max` ticks. */
function* fight(ctx: SectionContext, at: readonly [number, number], tag: string, waves: Array<(ctx: SectionContext) => void>, max = RF_A_LOCK_MAX): ScriptGen {
  yield ctx.waitCamera(at[0]);
  ctx.lockCamera(at[0], at[1]);
  for (let i = 0; i < waves.length; i++) {
    waves[i](ctx);
    const t0 = ctx.world.tick;
    // The next wave comes when this one is down to one (or after 6 s).
    yield () => ctx.world.countAlive(tag) <= (i === waves.length - 1 ? 0 : 1) || ctx.world.tick - t0 > (i === waves.length - 1 ? max : 360);
  }
  yield 20;
  ctx.unlockCamera();
}

/** The pacing guard (GDD 1.5): after this many ticks with no gang member in view, one walks in. */
export const RF_A_TRICKLE = 150;

/**
 * A background script for the whole section: whenever nobody of the gang has been in view for
 * `RF_A_TRICKLE` ticks (outside the locks, before the police line), a rider walks in from the
 * right — the 4-second rule holds however fast the squad clears the jam.
 */
function trickle(ctx: SectionContext): void {
  ctx.world.scripts.run(
    function* rfATrickle(): ScriptGen {
      let quiet = 0;
      let n = 0;
      for (;;) {
        yield 1;
        const w = ctx.world;
        const list = w.byTag('enemy');
        let seen = false;
        for (let i = 0; i < list.length && !seen; i++) if (list[i].alive && w.onScreen(list[i], 0)) seen = true;
        quiet = seen ? 0 : quiet + 1;
        if (quiet >= RF_A_TRICKLE && ctx.camera.right < RF_A_W - 160) {
          quiet = 0;
          right(ctx, n++ % 4 === 3 ? C : R, undefined, { look: n % 2 ? 'a' : 'b' }, 4);
        }
      }
    },
    { name: 'rf-a trickle' },
  );
}

export function* scriptRfA(ctx: SectionContext): ScriptGen {
  const N = normalUp(ctx);
  const H = hard(ctx);
  const P2 = ctx.playerCount >= 2;
  spawnJamScene(ctx.world, ctx.mission);
  trickle(ctx);
  // The tied hostage in the open parcel van, the weapon crates.
  ctx.spawn('hostage', RF_A_HOSTAGE_X, 'ground', { kind: 'tourist', bind: 'chair', drop: 'auto' });
  for (const [x, contains] of RF_A_CRATES) ctx.spawn('crate', x, 'ground', { contains });

  // @0 THE PARKED WAGONS: the queue ahead; two riders walk up from their dumped scooters.
  ctx.showGo();
  yield 40;
  right(ctx, R, 'rf-a0', { look: 'a' });
  yield 70;
  right(ctx, R, 'rf-a0', { look: 'b' });
  if (P2) right(ctx, R, 'rf-a0', { look: 'a' }, 40);
  // The NIET THUIS gag at the estate's window (he notices the squad with a double-take).
  yield ctx.waitCamera(110);
  ctx.spawn(C, 498, RF_GROUND, { facing: 1, gag: true, tag: 'rf-a0' });
  yield ctx.waitCamera(200);
  right(ctx, R, 'rf-a0', { look: 'b' });
  yield ctx.waitCamera(300);
  right(ctx, R, 'rf-a0');
  if (N) right(ctx, C, 'rf-a0', undefined, 40);
  yield ctx.waitCamera(470);
  right(ctx, K, 'rf-a0');

  // LOCK 1 (view 508–892): riders from both sides, a courier on the van's roof, the crew.
  yield* fight(ctx, RF_A_ARENAS.first, 'rf-a1', [
    (c) => {
      right(c, R, 'rf-a1');
      on(c, C, 664, ROOF.van, 'rf-a1');
      if (N) left(c, R, 'rf-a1', { look: 'b' });
    },
    (c) => {
      right(c, K, 'rf-a1');
      right(c, R, 'rf-a1', undefined, 46);
      if (P2) left(c, R, 'rf-a1');
      if (H) left(c, K, 'rf-a1');
    },
  ]);

  // The box truck and the camper: couriers lob parcels from the roofs; riders keep coming.
  yield 30;
  right(ctx, R);
  yield ctx.waitCamera(780);
  right(ctx, C);
  yield ctx.waitCamera(870);
  right(ctx, R, undefined, { look: 'b' });
  if (N) right(ctx, R, undefined, undefined, 30);
  yield ctx.waitCamera(960);
  on(ctx, C, 1300, ROOF.boxTruck);
  if (N) right(ctx, R, undefined, { look: 'b' });
  yield ctx.waitCamera(1130);
  right(ctx, R);
  on(ctx, C, 1470, ROOF.camper);
  yield ctx.waitCamera(1300);
  // Fixer (2026-10-22): the van crew here only on hard. On normal the rider and this crew stood on
  // the K-barrier at 1560 while the courier lobbed from the camper roof: the bot died 2-4 times at
  // x 1425 (seed 2: 6 deaths, rf-a 98 s). Lock 2 still brings the crew.
  if (H) right(ctx, K);

  // LOCK 2 (view 1308–1692): the gang's parcel van with the tied hostage; the crew guards it.
  yield* fight(ctx, RF_A_ARENAS.van, 'rf-a2', [
    (c) => {
      c.spawn(K, 1730, RF_GROUND, { facing: -1, tag: 'rf-a2', wait: 50 });
      right(c, R, 'rf-a2', undefined, 40);
      // Integrator, wave B: the rider from behind only on hard or in 2P (normal: the bot died 2–3
      // times here per level, mostly to three riders' pistols at once while the camper courier lobbed).
      if (H || P2) left(c, R, 'rf-a2');
    },
    (c) => {
      on(c, C, 1650, CAR_Y - 42, 'rf-a2');
      right(c, R, 'rf-a2');
      if (N) right(c, K, 'rf-a2', undefined, 30);
      if (P2) left(c, C, 'rf-a2');
    },
  ]);

  // The second NIET THUIS card, the coach with two couriers on its roof.
  yield 20;
  right(ctx, R);
  yield ctx.waitCamera(1570);
  right(ctx, R, undefined, { look: 'b' });
  yield ctx.waitCamera(1650);
  ctx.spawn(C, 1786, RF_GROUND, { facing: 1, gag: true });
  right(ctx, R, undefined, { look: 'b' }, 40);
  yield ctx.waitCamera(1860);
  on(ctx, C, 2090, ROOF.bus);
  if (N) on(ctx, C, 2160, ROOF.bus);
  right(ctx, R);
  yield ctx.waitCamera(2060);
  right(ctx, K);
  if (H) right(ctx, R, undefined, undefined, 40);
  yield ctx.waitCamera(2110);
  right(ctx, R, undefined, { look: 'b' });

  // LOCK 3 (view 2128–2512): the last fight before the police line.
  yield* fight(ctx, RF_A_ARENAS.last, 'rf-a3', [
    (c) => {
      right(c, R, 'rf-a3');
      left(c, C, 'rf-a3');
      on(c, C, 2428, ROOF.van, 'rf-a3');
    },
    (c) => {
      right(c, K, 'rf-a3');
      right(c, R, 'rf-a3', { look: 'b' }, 30);
      if (N) left(c, R, 'rf-a3');
      if (P2) right(c, C, 'rf-a3', undefined, 30);
    },
    (c) => {
      right(c, R, 'rf-a3');
      right(c, R, 'rf-a3', { look: 'b' }, 40);
      if (N) right(c, K, 'rf-a3', undefined, 30);
      if (H) left(c, K, 'rf-a3');
    },
  ]);

  // The run to the police line: the last riders.
  yield 30;
  right(ctx, R);
  yield ctx.waitCamera(2480);
  right(ctx, K);
  yield ctx.waitCamera(2560);
  right(ctx, R, undefined, { look: 'b' });
  if (N) right(ctx, C, undefined, undefined, 40);
  yield ctx.waitCamera(2660);
  right(ctx, R);
  on(ctx, C, 2884, CAR_Y - 24);
  yield ctx.waitCamera(2740);
  right(ctx, R, undefined, { look: 'b' });
  if (N) right(ctx, K, undefined, undefined, 40);
  yield ctx.waitCamera(RF_A_W - 384 - 1);
  ctx.showGo();
}
