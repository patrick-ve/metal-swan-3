/**
 * m4-b — Bandwagon Boulevard (GDD §11.4): 3600×216, scroll right, checkpoints 1300, 2400, 3216,
 * vehicles allowed: `bandwagon`. The Bandwagon section: the captured parade truck waits at x 120
 * with its engine running; the boulevard has two low ramps, balconies and two rooftops over the
 * road, parade floats with hostages, a STRIKE line of wind-up bots, the Battle of the Bands, and
 * the barricade fight (LOCK 3216–3600). Then the subway hatch opens: SUBWAY ↓ (`c1`, drop into the
 * stairs at 3440–3480) or ROOFTOPS ↑ (`c2`, the top of the fire escape).
 *
 * Layout notes (reported): the SUBWAY exit rect is y 196–248 (GDD 176–216) over an invisible
 * floor at y 242 under the hole (below the view, above killY 248), as in m1-a: a player who drops
 * in takes the exit at once, and the bot's planner sees a safe drop when it wants down and a gap
 * when it crosses. The ROOFTOPS rect reaches
 * y 70 so feet on the top landing (y 68) are inside it. A subway canopy (one-way, 3396–3436,
 * y 150) and a wider first fire-escape step (3504–3570, y 140; GDD 3530–3570) make the climb to
 * the fire escape a chain of short hops over the open stairs. After the barricade fight a body wall at
 * x 3424 stops vehicles (players walk on): "the Bandwagon cannot go on".
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { Vehicle } from '../../../vehicle';
import { BG_BOULEVARD } from './backgrounds';
import { SIGN } from './art';
import { M4Hatch } from './entities';
import { anyoneRiding, at, fromRight, G, roadRight, stage, topUpVehicles, twoPlayers, vehiclesOf, WAGON } from './helpers';

export const B_W = 3600;
/** The barricade arena (camera lock). */
export const B_ARENA = { x0: 3216, x1: 3600 } as const;
/** The subway stairs: a 40 px hole under the hatch. */
export const B_HOLE = { x: 3440, w: 40 } as const;
/** Top of the SUBWAY exit rect and the invisible floor under the hole (see the header). */
const HOLE_EXIT_Y = 196;
const HOLE_FLOOR_Y = 242;
const BALCONY_Y = 112;
/** Vehicles stop here once the barricade is down (the subway stairs start at 3440). */
const END_OF_ROAD = 3424;
const ROOF_Y = 96;

const t = terrain(B_W, 216);
t.ground()
  .at(0, G)
  .flat(1440)
  .hill(120, 12) // 1440–1560: the first low ramp
  .flat(980)
  .hill(120, 12) // 2540–2660: the second
  .flat(B_HOLE.x - 2660)
  .gap(B_HOLE.w) // 3440–3480: the subway stairs
  .flat(B_W - B_HOLE.x - B_HOLE.w);
// The stairs' floor: a terrain block below the view (see the header). Terrain, not a dynamic
// solid: the bot's jump planner ignores terrain floors more than 64 px down when it only crosses
// the hole, but lands on any dynamic solid.
t.solid(B_HOLE.x, HOLE_FLOOR_Y, B_HOLE.w, 6, 'concrete');
t.platform(1100, BALCONY_Y, 200);
t.platform(1880, ROOF_Y, 60);
t.platform(1980, ROOF_Y, 60);
// The fire escape up to the ROOFTOPS exit.
// The subway entrance canopy (added): a stepping stone from the street over the stairs to the
// fire escape, so the climb never starts with a long jump from the stairs' edge.
t.platform(3396, 150, 40);
t.platform(3504, 140, 66); // GDD 3530–3570: starts at 3504 (over the barricade's pile)
t.platform(3550, 104, 50);
t.platform(3560, 68, 40);

const decor: DecorDef[] = [
  { sprite: 'decor/m4/sign', frame: SIGN.management, x: 196, y: G },
  ...[340, 900, 1640, 2300, 2900].map((x): DecorDef => ({ sprite: 'decor/m4/lamp-post', x, y: G })),
  ...[1130, 1270, 1906, 2006].map((x): DecorDef => ({ sprite: 'decor/m4/banner', x, y: x < 1500 ? 60 : 44 })),
  { sprite: 'decor/m4/subway-globe', x: 3388, y: G },
  { sprite: 'decor/m4/fire-escape', x: 3528, y: 68 },
];

export const sectionB: SectionDef = {
  id: 'b',
  name: 'Bandwagon Boulevard',
  width: B_W,
  height: 216,
  scroll: 'right',
  background: BG_BOULEVARD,
  terrain: t.build(),
  terrainStyle: { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'metal' },
  decor,
  playerStart: { x: 48, y: G },
  checkpoints: [1300, 2400, 3216],
  timeLimit: 60,
  vehicles: [WAGON],
  bossStart: { x: 3040, y: G },
  exits: [
    {
      id: 'subway',
      rect: { x: B_HOLE.x, y: HOLE_EXIT_Y, w: B_HOLE.w, h: HOLE_FLOOR_Y + 6 - HOLE_EXIT_Y },
      to: 'c1',
      disabled: true,
      entry: { x: 48, y: 152 },
    },
    { id: 'rooftops', rect: { x: 3560, y: 20, w: 40, h: 50 }, to: 'c2', disabled: true },
  ],
  *script(ctx) {
    const hatch = ctx.spawn('m4-hatch', B_HOLE.x, G, { w: B_HOLE.w });
    // The Bandwagon waits with its engine running ([2P] a second one).
    yield 1;
    const guards = { spawned: false };
    if (ctx.bossRush) {
      // ?boss=1: start a little before the lock with the barricade already manned.
      topUpVehicles(ctx, WAGON, [3110, 2990]);
      spawnBarricade(ctx, guards);
    }
    else {
      topUpVehicles(ctx, WAGON, twoPlayers(ctx) ? [120, 40] : [120]);
      yield* boulevard(ctx, guards);
    }
    yield* barricade(ctx, hatch, guards);
  },
};

/** The boulevard before the barricade (skipped with ?boss=1). */
function* boulevard(ctx: SectionContext, guards: { spawned: boolean }): ScriptGen {
  // Standing placements of the rows, staged just before they scroll into view.
  stage(ctx, 600, () => {
    at(ctx, 'anthem-speaker', 600, { facing: -1 });
    for (const x of [640, 670, 700]) at(ctx, 'rifleman', x, { facing: -1 });
  });
  stage(ctx, 1150, () => {
    for (const x of [1150, 1200, 1250]) at(ctx, 'bassoonist', x, { facing: -1 }, BALCONY_Y);
  });
  stage(ctx, 1910, () => {
    at(ctx, 'gramophone-mortar', 1910, { facing: -1 }, ROOF_Y);
    at(ctx, 'gramophone-mortar', 2010, { facing: -1 }, ROOF_Y);
  });
  stage(ctx, 3100, () => {
    at(ctx, 'bassoonist', 3100, { facing: -1 });
    at(ctx, 'anthem-speaker', 3120, { facing: -1 });
    at(ctx, 'bassoonist', 3150, { facing: -1 });
  });
  // The barricade and its guards stand ready before the lock scrolls into view.
  stage(ctx, 3300, () => spawnBarricade(ctx, guards));

  // @0: four riflemen run in.
  for (let i = 0; i < 4; i++) {
    fromRight(ctx, 'rifleman');
    yield 28;
  }
  // The hint once somebody drives.
  yield () => anyoneRiding(ctx, WAGON) || ctx.camera.left >= 300;
  const wagon = vehiclesOf(ctx, WAGON).find((v) => v.state === 'driven');
  if (wagon) ctx.hud.bubble(wagon, 'FIRE + BOMB: CYMBAL WALL!', { kind: 'hint', ticks: 150 });

  yield ctx.waitCamera(300);
  roadRight(ctx, 'oompah-tank', { stopX: 800 }, 48);

  // @700 the parade: a giant tuba float and a giant drum float roll at the players.
  yield ctx.waitCamera(700);
  roadRight(ctx, 'parade-float', { variant: 'tuba' }, 48);
  yield 150;
  roadRight(ctx, 'parade-float', { variant: 'drum', hostage: { id: 'hostage', params: { kind: 'critic', bind: 'float', drop: 'M' } } }, 48);

  // @1300: two tanks and the STRIKE line.
  yield ctx.waitCamera(1300);
  roadRight(ctx, 'oompah-tank', { stopX: 1700 }, 48);
  const x0 = ctx.camera.right + 16;
  for (let i = 0; i < 6; i++) at(ctx, 'windup-bot', x0 + i * 20, { facing: -1, tag: 'strike' });
  yield 150;
  roadRight(ctx, 'oompah-tank', { stopX: 1800 }, 48);

  // @2000: the third float with the tea lady.
  yield ctx.waitCamera(2000);
  roadRight(ctx, 'parade-float', { variant: 'tuba', hostage: { id: 'hostage', params: { kind: 'tea-lady', bind: 'float', drop: 'repair' } } }, 48);

  // @2400 Battle of the Bands: a band-truck drives head-on, honking in rhythm.
  yield ctx.waitCamera(2400);
  roadRight(ctx, 'band-truck', { ram: true, speed: 2 }, 48);

  yield ctx.waitCamera(2900);
  roadRight(ctx, 'oompah-tank', { stopX: 3200 }, 48);
}

/** The drum barricade (3496–3528) and its guards; all tagged 'barricade'. Spawned once. */
function spawnBarricade(ctx: SectionContext, guards: { spawned: boolean }): void {
  if (guards.spawned) return;
  guards.spawned = true;
  ctx.spawn('drum-barricade', 3512, 'ground', { tag: 'barricade' });
  const guard = { facing: -1, tag: 'barricade', gag: 'none' } as const;
  for (const x of [3300, 3340, 3380, 3420]) at(ctx, 'rifleman', x, guard);
  at(ctx, 'drummer', 3450, guard, G); // on the hatch
  at(ctx, 'drummer', 3480, guard);
  at(ctx, 'baton-major', 3470, guard, G);
}

/** @3216: the barricade fight, then the hatch and the route signs. */
function* barricade(ctx: SectionContext, hatch: unknown, guards: { spawned: boolean }): ScriptGen {
  yield ctx.waitCamera(B_ARENA.x0);
  spawnBarricade(ctx, guards);
  ctx.lockCamera(B_ARENA.x0, B_ARENA.x1);
  ctx.banner('BREAK THE BARRICADE!', { style: 'info', ticks: 120 });
  yield 30;
  yield ctx.waitClear('barricade');
  yield 30;
  // The Bandwagon cannot go on: vehicles stop at x 3424, players walk on. A pilot who keeps
  // pushing against the end of the road for 45 ticks is helped out of the cab.
  const pushed = new Map<unknown, number>();
  ctx.bodyWall(END_OF_ROAD, {
    players: false,
    vehicles: true,
    onTouch: (e) => {
      if (!(e instanceof Vehicle) || e.state !== 'driven') return;
      const n = (pushed.get(e) ?? 0) + 1;
      pushed.set(e, n);
      if (n === 45) {
        ctx.hud.bubble(e, 'END OF THE ROAD!', { kind: 'hint', ticks: 120 });
        e.eject('exit');
      }
    },
  });
  if (hatch instanceof M4Hatch) hatch.open();
  ctx.spawn('m4-sign', 3410, G, { frame: SIGN.subway });
  ctx.spawn('m4-sign', 3580, 68, { frame: SIGN.rooftops });
  ctx.enableExit('subway');
  ctx.enableExit('rooftops');
  ctx.unlockCamera();
  ctx.banner('PICK A ROUTE', { style: 'info', ticks: 150 });
  for (const v of vehiclesOf(ctx, WAGON)) {
    if (v.state === 'driven') ctx.hud.bubble(v, 'END OF THE ROAD! DOWN + JUMP', { kind: 'hint', ticks: 150 });
  }
}

/** Every entity id this section spawns (tests). */
export const B_IDS = [
  'm4-hatch', 'm4-sign', 'bandwagon', 'anthem-speaker', 'rifleman', 'bassoonist', 'gramophone-mortar', 'drum-barricade', 'drummer',
  'baton-major', 'oompah-tank', 'parade-float', 'windup-bot', 'band-truck', 'hostage',
] as const;
