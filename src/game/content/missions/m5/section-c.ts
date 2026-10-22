/**
 * m5-c — The Console (GDD §11.5, §10.5): one 384×216 screen, the console room at the heart of the
 * Grand Organ. Final boss stage 2, THE CONSOLE (`organ-console`), is fought on foot on the floor
 * and the three keyboard tiers (`m5-console-tier`, one-way platforms); when it breaks the tiers
 * fall away, three `wreck-block`s land on the floor (x 72, 192, 312) and stage 3, THE MAESTRO
 * (`maestro`), starts. His death sequence leads into the ending (the mission completes; after the
 * tally `flow.missionDone` plays the EndingScene because m5 has no next mission).
 *
 * The bosses are built in bosses/m5; this file builds the room, the tiers, the crates, Fanfaroni's
 * opening lines, the stage hand-over and the end.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import { hudOf } from '../../../context';
import { terrain, type DecorDef, type SectionContext, type SectionDef } from '../../../mission/index';
import { BG_CONSOLE } from './backgrounds';
import type { ConsoleTier } from './entities';
import { autoRun, clearRoom, SHIP, type GrampsShip } from './finale';
import { anyPlayer, bubble, crate, G, hasGramps, waitBoss } from './helpers';

export const C_W = 384;
export const C_H = 216;
/** GDD §10.5: the three tiers (one-way platforms; x0, x1, y). */
export const TIERS: readonly { x0: number; x1: number; y: number }[] = [
  { x0: 120, x1: 300, y: 148 },
  { x0: 150, x1: 300, y: 116 },
  { x0: 180, x1: 300, y: 84 },
];
/** The wreck blocks that land after stage 2 (centres). */
export const WRECK_X: readonly number[] = [72, 192, 312];
/** THE CONSOLE's anchor: the bottom centre of the console sprite (x 120–344, y 40–176). */
export const CONSOLE_AT = { x: 232, y: G } as const;
/** Fanfaroni on his bench (x 304–340, feet y 84): his opening lines come from here. */
export const BENCH = { x: 322, y: 84 } as const;
/** THE MAESTRO's spawn (bosses/m5 geom: the room's floor centre; the podium flies up from there). */
export const MAESTRO_AT = { x: 192, y: G } as const;

const t = terrain(C_W, C_H);
t.ground().at(0, G).flat(C_W);

const decor: DecorDef[] = [];

// ---------------------------------------------------------------------------------------------
// Script pieces
// ---------------------------------------------------------------------------------------------

function spawnTiers(ctx: SectionContext): ConsoleTier[] {
  return TIERS.map((tr, i) => ctx.spawn('m5-console-tier', tr.x0, tr.y, { w: tr.x1 - tr.x0, level: i }) as ConsoleTier);
}

/** Fanfaroni speaks: through the boss when it exists, else a bubble over his bench. */
function speak(ctx: SectionContext, boss: Entity, text: string, ticks: number): void {
  if (boss instanceof Boss) boss.say(text, { ticks });
  else hudOf(ctx.world).bubble({ x: BENCH.x - 60, y: BENCH.y + 16 }, text, { kind: 'gag', ticks });
}

function countType(ctx: SectionContext, type: string): number {
  let n = 0;
  for (const e of ctx.world.entities) if (e.alive && e.type === type) n++;
  return n;
}

function findType(ctx: SectionContext, type: string): Entity | null {
  for (const e of ctx.world.entities) if (e.alive && e.type === type) return e;
  return null;
}

/** Stage 2: THE CONSOLE. */
function* stageConsole(ctx: SectionContext): ScriptGen {
  const boss = ctx.spawn('organ-console', CONSOLE_AT.x, CONSOLE_AT.y, { left: 0 });
  // Hold the fight for his opening lines (the boss starts with the WARNING banner).
  if (boss instanceof Boss) boss.autoStart = false;
  yield 30;
  speak(ctx, boss, 'AH. THE AUDIENCE HAS ARRIVED.', 100);
  yield 110;
  speak(ctx, boss, 'PLEASE HOLD YOUR APPLAUSE. FOREVER.', 110);
  yield 100;
  if (boss instanceof Boss) boss.start();
  yield ctx.bossIntro('THE CONSOLE', { subtitle: 'HIS LOUDNESS WILL NOW PERFORM' });
  yield* waitBoss(boss);
}

/** The hand-over: tiers fall, wreck blocks land, the intermission crates drop. */
function* intermission(ctx: SectionContext, tiers: readonly ConsoleTier[]): ScriptGen {
  for (const tr of tiers) if (tr.alive && !tr.collapsing) tr.collapse();
  yield 1;
  // The boss module may land the blocks itself; never twice.
  if (countType(ctx, 'wreck-block') === 0) for (const x of WRECK_X) ctx.spawn('wreck-block', x, G, { drop: true });
  crate(ctx, 40, ctx.camera.top - 24, 'bombs');
  crate(ctx, 344, ctx.camera.top - 24, 'R');
}

/** Stage 3: THE MAESTRO (unless stage 2's death already launched him), then the finale. */
function* stageMaestro(ctx: SectionContext): ScriptGen {
  const boss = findType(ctx, 'maestro') ?? ctx.spawn('maestro', MAESTRO_AT.x, MAESTRO_AT.y, { left: 0 });
  yield ctx.bossIntro('THE MAESTRO', { subtitle: 'GRAND MARSHAL BOMBASTIAN FANFARONI' });
  if (boss instanceof Boss) {
    // GDD §10.5: the auto-run starts inside his death sequence, after the squeak.
    yield () => boss.dead || boss.defeated;
    yield FINALE.afterSqueak;
  } else yield 180;
  yield* finale(ctx, boss);
}

/** Finale timings (ticks). */
export const FINALE = { afterSqueak: 90, flyOff: 80, maxDeathWait: 400 } as const;

/**
 * GDD §10.5: the room falls apart; the players auto-run right and jump into a Trumpeter flown by
 * Gramps (Gusto when Gramps is a player); it flies off; then the ending (the mission completes;
 * after the tally `flow.missionDone` plays the EndingScene because m5 has no next mission).
 */
function* finale(ctx: SectionContext, boss: Entity): ScriptGen {
  const gramps = hasGramps(ctx);
  clearRoom(ctx);
  // It drops in through the hole Fanfaroni's exit left in the roof.
  const ship = ctx.spawn('m5-gramps-ship', ctx.camera.left + SHIP.hoverX, ctx.camera.top - 70, { pilot: gramps ? 'gusto' : 'gramps' }) as GrampsShip;
  ctx.world.scripts.run(autoRun(ctx, ship));
  yield () => ship.arrived;
  if (gramps) {
    const p = anyPlayer(ctx);
    if (p) bubble(ctx, p, 'GUSTO: LA-LAAA! ALL ABOARD, CYGNETS!', 'radio', 150);
  } else hudOf(ctx.world).bubble({ x: ship.x - 8, y: ship.y - 46 }, "I'M A PILOT NOW TOO.", { kind: 'gag', ticks: 150 });
  yield () => ship.allAboard(ctx.players);
  // Let his death sequence finish (he floats away under his bicorne) before the ship leaves.
  if (boss instanceof Boss) {
    let t = 0;
    yield () => boss.defeated || ++t > FINALE.maxDeathWait;
  }
  yield 20;
  ship.leave();
  yield FINALE.flyOff;
  yield ctx.missionComplete();
}

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

export const sectionC: SectionDef = {
  id: 'c',
  name: 'The Console',
  width: C_W,
  height: C_H,
  scroll: 'right',
  background: BG_CONSOLE,
  terrain: t.build(),
  terrainStyle: { ground: 'metal', edge: 'tiles', platform: 'wood', solid: 'metal' },
  decor,
  playerStart: { x: 48, y: G },
  bossStart: { x: 48, y: G },
  timeLimit: 60,
  *script(ctx) {
    ctx.lockCamera(0, C_W);
    const tiers = spawnTiers(ctx);
    crate(ctx, 40, 'ground', 'H');
    yield* stageConsole(ctx);
    yield* intermission(ctx, tiers);
    yield 60;
    yield* stageMaestro(ctx);
  },
};

/** Every id this section spawns (the bosses included). */
export const C_IDS: readonly string[] = ['m5-console-tier', 'crate', 'organ-console', 'wreck-block', 'maestro', 'm5-gramps-ship'];
