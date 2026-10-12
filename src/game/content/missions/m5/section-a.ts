/**
 * m5-a — Above the Clouds (GDD §11.5): 4400×216, the shoot-em-up. The players fly their
 * Trumpeters (`startVehicle`) through an open dusk sky while the view auto-scrolls at 1.0
 * px/tick; drone formations, air copters, piano bombers, flying bandbots, parachute crates and two
 * balloon hostages. At @4016 the scroll stops in the lock 4016–4400 and the final boss stage 1,
 * THE GRAND ORGAN (`grand-organ`, built in bosses/m5), fights them; when it is down the
 * Trumpeters fly into its landing hatch and the team goes on to `b`.
 *
 * Spawns appear at view x 400 (16 px right of the view) at the y the GDD gives.
 */
import type { Entity } from '../../../../engine/entity';
import type { ScriptGen } from '../../../../engine/script';
import { Boss } from '../../../boss';
import { terrain, type SectionContext, type SectionDef } from '../../../mission/index';
import { Pickup } from '../../../pickup';
import type { Player } from '../../../player/player';
import type { SpawnParams } from '../../../registry';
import { TRUMPETER } from '../../vehicles/fleet/numbers';
import { trumpeterOf } from '../../vehicles/fleet/trumpeter';
import { BG_SKY } from './backgrounds';
import { anyPlayer, bubble, crate, hasGramps, hostage, normalUp, waitBoss } from './helpers';

export const A_W = 4400;
export const A_H = 216;
/** GDD: the boss lock (and the last checkpoint). */
export const ARENA_X = 4016;
export const SCROLL_SPEED = 1.0;
/** Spawns appear here (view x). */
export const SPAWN_VX = 400;
/**
 * THE GRAND ORGAN's spawn point: its 300×200 face hovers at view x 200–384+ (partly off-screen),
 * so the anchor is the face's centre (view x 350, view y 108).
 */
export const ORGAN_AT = { x: ARENA_X + 350, y: 108 } as const;
/** Where the Trumpeters fly when the organ opens its landing hatch (unless the boss names one). */
export const HATCH_AT = { x: ARENA_X + 260, y: 150 } as const;
/** GDD: the fly-in lasts 120 ticks. */
export const HATCH_TICKS = 120;

// Open sky: no terrain at all (the Trumpeters fly; pianos fall through the screen).
const t = terrain(A_W, A_H);

// ---------------------------------------------------------------------------------------------
// Script pieces
// ---------------------------------------------------------------------------------------------

/** Spawn at view x 400 (or `vx`) at height y. */
function sky(ctx: SectionContext, id: string, y: number, params?: SpawnParams, vx = SPAWN_VX): Entity {
  return ctx.spawn(id, ctx.camera.left + vx, y, { facing: -1, ...params });
}

/** One drone formation of 5. */
function drones(ctx: SectionContext, formation: string, y: number, extra?: SpawnParams): Entity {
  return sky(ctx, 'kazoo-drone', y, { formation, ...extra });
}

/** A parachute crate drifting down from above the view at view x `vx`. */
function chuteCrate(ctx: SectionContext, vx: number, contains: string): Entity {
  return crate(ctx, ctx.camera.left + vx, ctx.camera.top - 4, contains, { chute: true });
}

/**
 * Sky catch (shoot-em-up adaptation): there is no floor under m5-a, so every item that appears
 * (a broken crate's contents, an enemy drop) is thrown at the nearest player at once — it flies
 * to the Trumpeter instead of falling out of the sky. Hostage gifts are tossed by the balloon
 * hostages themselves; tossing again only retargets them.
 */
function* skyCatch(ctx: SectionContext): ScriptGen {
  const seen = new WeakSet<Entity>();
  const world = ctx.world;
  for (;;) {
    const items = world.byTag('item');
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (seen.has(it)) continue;
      seen.add(it);
      if (!(it instanceof Pickup) || it.taken) continue;
      const p = world.nearestPlayer(it.x, it.y);
      if (p) it.tossTo(p as Player);
    }
    yield 1;
  }
}

/** GDD: P1 at view y 80, P2 at view y 130, both at view x 64. */
function placeShips(ctx: SectionContext): void {
  for (const p of ctx.players) {
    const ship = trumpeterOf(p);
    if (!ship) continue;
    const vy = TRUMPETER.startY[p.index === 1 ? 1 : 0];
    ship.x = ship.prevX = ctx.camera.left + TRUMPETER.flyInX;
    ship.y = ship.prevY = ctx.camera.top + vy - TRUMPETER.driverDy;
  }
}

/** The start radio: Gramps is proud of his flying swan. */
function* startRadio(ctx: SectionContext): ScriptGen {
  yield 40;
  ctx.world.audio.voice('TRUMPETER!');
  yield 70;
  const gramps = ctx.players.find((p) => p.character.id === 'gramps') ?? null;
  const other = ctx.players.find((p) => p.character.id !== 'gramps') ?? null;
  if (!hasGramps(ctx)) {
    const p = anyPlayer(ctx);
    if (p) bubble(ctx, p, "GRAMPS: SHE FLIES! DON'T TELL ACCOUNTING!", 'radio', 180);
  } else if (gramps) {
    bubble(ctx, gramps, "SHE FLIES! DON'T TELL ACCOUNTING!", 'gag', 150);
    if (other) {
      yield 100;
      bubble(ctx, other, 'YOU MADE HER FLY?!', 'gag', 120);
    }
  }
}

/** The boss stage: lock, the arena crate, THE GRAND ORGAN, then the landing hatch → `b`. */
function* organFight(ctx: SectionContext): ScriptGen {
  ctx.lockCamera(ARENA_X, A_W);
  chuteCrate(ctx, 300, 'repair');
  const boss = ctx.spawn('grand-organ', ORGAN_AT.x, ORGAN_AT.y, { left: ARENA_X });
  yield ctx.bossIntro('THE GRAND ORGAN', { subtitle: "TONIGHT'S PROGRAMME: YOU" });
  yield* waitBoss(boss);
  yield* landingHatch(ctx, boss);
  yield ctx.exitTo('b');
}

/** GDD: the Trumpeters fly into the landing hatch (automatic, 120 ticks). */
function* landingHatch(ctx: SectionContext, boss: Entity): ScriptGen {
  const named = (boss as Entity & { hatch?: { x: number; y: number } }).hatch;
  const hx = boss instanceof Boss && named ? named.x : HATCH_AT.x;
  const hy = boss instanceof Boss && named ? named.y : HATCH_AT.y;
  for (const p of ctx.players) {
    const ship = trumpeterOf(p);
    if (!ship) continue;
    const d = Math.hypot(hx - ship.x, hy - ship.y);
    ship.flyTo(hx, hy, Math.max(1, d / (HATCH_TICKS - 20)));
  }
  ctx.world.audio.sfx('trumpeter/flap');
  yield HATCH_TICKS;
}

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

export const sectionA: SectionDef = {
  id: 'a',
  name: 'Above the Clouds',
  width: A_W,
  height: A_H,
  scroll: 'right',
  background: BG_SKY,
  terrain: t.build(),
  terrainStyle: { ground: 'metal', edge: 'rust', platform: 'metal', solid: 'metal' },
  playerStart: { x: TRUMPETER.flyInX, y: TRUMPETER.startY[0] },
  bossStart: { x: ARENA_X + TRUMPETER.flyInX, y: TRUMPETER.startY[0] },
  checkpoints: [1200, 2400, 3600, ARENA_X],
  timeLimit: 60,
  startVehicle: 'trumpeter',
  vehicles: ['trumpeter'],
  *script(ctx) {
    placeShips(ctx);
    ctx.spawn('m5-dusk', 0, 0, { endX: ARENA_X, alpha: 0.3 });
    ctx.world.scripts.run(skyCatch(ctx));
    if (ctx.bossRush) {
      yield* organFight(ctx);
      return;
    }
    ctx.autoScroll(SCROLL_SPEED);
    ctx.world.scripts.run(startRadio(ctx));

    // @0: a V of drones.
    drones(ctx, 'v', 60);

    // @240: two sine formations.
    yield ctx.waitCamera(240);
    drones(ctx, 'sine', 40);
    drones(ctx, 'sine', 140);

    // @480: two air copters.
    yield ctx.waitCamera(480);
    sky(ctx, 'baton-copter', 50, { mode: 'air', enter: 'right' });
    sky(ctx, 'baton-copter', 150, { mode: 'air', enter: 'right' }, SPAWN_VX + 32);

    // @720: a piano bomber crosses above (its pianos fall through the screen).
    yield ctx.waitCamera(720);
    ctx.enter('piano-bomber', 'right', { y: 20, params: { mode: 'air' } });

    // @960 / @1100: parachute crates.
    yield ctx.waitCamera(960);
    chuteCrate(ctx, 300, 'bombs');
    yield ctx.waitCamera(1100);
    chuteCrate(ctx, 320, 'repair');

    // @1200: two loop formations (shooters) and six flying bandbots in a line.
    yield ctx.waitCamera(1200);
    drones(ctx, 'loop', 140, { shooter: 2 });
    for (let i = 0; i < 6; i++) sky(ctx, 'windup-bot', 100, { variant: 'fly' }, SPAWN_VX + i * 20);
    yield 150;
    drones(ctx, 'loop', 160, { shooter: 2 });

    // @1500: two dive formations.
    yield ctx.waitCamera(1500);
    drones(ctx, 'dive', 28);
    yield 120;
    drones(ctx, 'dive', 28);

    // @1800: two piano bombers, high and low; the players fly between them.
    yield ctx.waitCamera(1800);
    ctx.enter('piano-bomber', 'right', { y: 24, params: { mode: 'air' } });
    ctx.enter('piano-bomber', 'right', { y: 150, params: { mode: 'air' } });

    // @2100: the tourist on a balloon (SAY CHEESE).
    yield ctx.waitCamera(2100);
    hostage(ctx, 'tourist', 'balloon', ctx.camera.left + SPAWN_VX, 60, 'auto');

    // @2400: three air copters and a V.
    yield ctx.waitCamera(2400);
    for (let i = 0; i < 3; i++) sky(ctx, 'baton-copter', 50 + i * 50, { mode: 'air', enter: 'right' }, SPAWN_VX + i * 40);
    drones(ctx, 'v', 100);

    // @2700: a piano bomber and two sine formations.
    yield ctx.waitCamera(2700);
    ctx.enter('piano-bomber', 'right', { y: 20, params: { mode: 'air' } });
    drones(ctx, 'sine', 70);
    yield 90;
    drones(ctx, 'sine', 150);

    // @2900: a parachute crate.
    yield ctx.waitCamera(2900);
    chuteCrate(ctx, 300, 'bombs');

    // @3000: the Grand Organ appears far away.
    yield ctx.waitCamera(3000);
    ctx.spawn('organ-distant', ctx.camera.left + 300, 92, { grow: 600 });

    // @3300: [N] three dive formations.
    yield ctx.waitCamera(3300);
    if (normalUp(ctx)) {
      for (let i = 0; i < 3; i++) {
        drones(ctx, 'dive', 28);
        yield 100;
      }
    }

    // @3600: the critic on a balloon (a weapon gift = +10 dive bombs).
    yield ctx.waitCamera(3600);
    hostage(ctx, 'critic', 'balloon', ctx.camera.left + SPAWN_VX, 90, 'auto');

    // @4016: stop, lock and THE GRAND ORGAN.
    yield ctx.waitCamera(ARENA_X);
    for (const e of ctx.world.byTag('decor')) if (e.type === 'organ-distant') e.remove();
    yield* organFight(ctx);
  },
};

/** Every id this section spawns (the boss included). */
export const A_IDS: readonly string[] = ['m5-dusk', 'kazoo-drone', 'baton-copter', 'piano-bomber', 'crate', 'windup-bot', 'hostage', 'organ-distant', 'grand-organ'];
