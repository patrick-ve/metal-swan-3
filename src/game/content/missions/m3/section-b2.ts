/**
 * m3-b2 — Echo Caves (GDD §11.3): 384×1800, scroll up, checkpoints y 950, 420. The CAVES → route:
 * crystal ledges up an ice cave between two crystal walls, echo bats, metronome turrets hung under
 * the ledges, a cracked crystal wall hiding the golden record, the rising meltwater (from the
 * checkpoint at y 950), the Icicle Organ and the top fight; the top rect leads to `c`.
 */
import { terrain, type DecorDef, type SectionContext, type SectionDef } from '../../../mission/index';
import { RisingWater } from '../../props/set-pieces';
import { BG_ECHO_CAVES } from './backgrounds';
import { at, crate, hostage, stageY, waitClearUp } from './helpers';

export const B2_W = 384;
export const B2_H = 1800;
export const FLOOR_Y = 1776;
/** Ledge y of index k (36 px apart): odd k on the left (24–200), even k on the right (184–360). */
export const ledgeY = (k: number): number => FLOOR_Y - 36 * k;
/** The Icicle Organ: 8 icicles with their tops at y 808, x = 60 + 38i. */
export const ORGAN_TOP = 808;
export const ORGAN_X: readonly number[] = Array.from({ length: 8 }, (_, i) => 60 + 38 * i);
/** The meltwater: starts at y 1300 when the checkpoint at y 950 is reached. */
export const WATER = { startY: 1300, speed: 0.3, lag: 48, finalSpeed: 0.15, finalCap: 48 } as const;

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

const t = terrain(B2_W, B2_H);
t.ground().at(0, FLOOR_Y).flat(B2_W);
t.solid(0, 0, 24, B2_H, 'rock').solid(360, 0, 24, B2_H, 'rock');
for (let k = 1; k <= 48; k++) t.platform(k % 2 ? 24 : 184, ledgeY(k), 176);

const decor: DecorDef[] = [
  // The crystal walls (front decor exactly over the wall solids: nothing stands inside them).
  ...Array.from({ length: B2_H / 120 }, (_, i): DecorDef[] => [
    { sprite: 'decor/m3/crystal-wall', frame: 0, x: 0, y: i * 120, front: true },
    { sprite: 'decor/m3/crystal-wall', frame: 1, x: 360, y: i * 120, front: true },
  ]).flat(),
  // An underground waterfall behind the ledges.
  { sprite: 'decor/m3/waterfall', x: 112, y: 1296, animate: 6 },
  { sprite: 'decor/m3/waterfall', x: 112, y: 1456, animate: 6 },
  { sprite: 'decor/m3/waterfall', x: 112, y: 1616, animate: 6 },
  { sprite: 'decor/m3/waterfall', x: 290, y: 300, animate: 6 },
  { sprite: 'decor/m3/waterfall', x: 290, y: 460, animate: 6 },
];

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

/** Echo bats awake from the sides (the swarm rows). */
function batsIn(ctx: SectionContext, n: number, entry: string, tag?: string): void {
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? 'left' : 'right';
    ctx.enter('echo-bat', side, { y: ctx.camera.top + 40 + (i % 3) * 24, margin: 16 + i * 10, params: { enter: entry }, tag });
  }
}

export const sectionB2: SectionDef = {
  id: 'b2',
  name: 'Echo Caves',
  width: B2_W,
  height: B2_H,
  scroll: 'up',
  background: BG_ECHO_CAVES,
  terrain: t.build(),
  terrainStyle: { ground: 'ice', edge: 'snow', platform: 'rock', solid: 'rock' },
  decor,
  playerStart: { x: 192, y: FLOOR_Y },
  checkpoints: [950, 420],
  timeLimit: 60,
  exits: [{ id: 'summit', rect: { x: 140, y: 0, w: 104, h: 24 }, to: 'c', disabled: true }],
  *script(ctx) {
    ctx.showGo('up');
    // Start: three echo bats hang under the first ledges.
    at(ctx, 'echo-bat', 100, {}, ledgeY(5) + 4);
    at(ctx, 'echo-bat', 190, {}, ledgeY(5) + 4);
    at(ctx, 'echo-bat', 300, {}, ledgeY(6) + 4);

    // Standing placements, staged just above the view's top edge.
    stageY(ctx, ledgeY(7), () => {
      for (let i = 0; i < 4; i++) at(ctx, 'windup-bot', 44 + i * 22, { facing: 1 }, ledgeY(7));
    });
    stageY(ctx, ledgeY(8), () => crate(ctx, 300, 'T', ledgeY(8)));
    stageY(ctx, 1348, () => ctx.spawn('metronome-turret', 192, ledgeY(12) + 4));
    // The cracked crystal wall (secret): it hides the golden record.
    stageY(ctx, 1128 - 48, () =>
      ctx.spawn('breakable-wall', 340, ledgeY(18), { solid: false, look: 'crystal', reveal: { id: 'pickup-gem', params: { kind: 'golden-record' } } }),
    );
    stageY(ctx, 1092, () => hostage(ctx, 'critic', 'chair', 64, 'S', ledgeY(19)));
    stageY(ctx, 984, () => at(ctx, 'bassoonist', 300, { facing: -1 }, ledgeY(22)));
    stageY(ctx, 696, () => hostage(ctx, 'tea-lady', 'chair', 300, 'auto', ledgeY(30)));
    stageY(ctx, 588, () => {
      at(ctx, 'rifleman', 60, { facing: 1 }, ledgeY(33));
      at(ctx, 'rifleman', 150, { facing: 1 }, ledgeY(33));
      at(ctx, 'rifleman', 250, { facing: -1 }, ledgeY(34));
      at(ctx, 'cymbalist', 320, { facing: -1 }, ledgeY(34));
    });
    stageY(ctx, 520, () => ctx.spawn('metronome-turret', 100, ledgeY(35) + 4));
    // @420: the roadie's cage hangs under the ledge at y 408 and falls onto the one at y 444.
    stageY(ctx, 410, () => hostage(ctx, 'roadie', 'cage', 192, 'M', ledgeY(37) - 1, { ropeTop: ledgeY(38) + 2 }));

    // @1400: four bats awake.
    yield ctx.waitCameraY(1400);
    batsIn(ctx, 4, 'fly');

    // @950 (checkpoint): the meltwater starts rising; the Icicle Organ hangs above.
    yield ctx.waitCameraY(950);
    const water = ctx.spawn('rising-water', 192, WATER.startY, { startY: WATER.startY, speed: WATER.speed, lag: WATER.lag });
    ctx.banner('THE ICE IS MELTING! CLIMB!', { style: 'warning', ticks: 150 });
    for (const x of ORGAN_X) ctx.spawn('icicle', x, ORGAN_TOP, { organ: 'm3-organ' });

    // @760: a sine swarm of bats.
    yield ctx.waitCameraY(760);
    batsIn(ctx, 6, 'swarm');

    // @250: the top ledges: a drum major, two bassoonists, four bats. WAIT dead.
    yield ctx.waitCameraY(250 + 40);
    const tag = 'top';
    at(ctx, 'baton-major', 300, { facing: -1 }, ledgeY(42), tag);
    at(ctx, 'bassoonist', 250, { facing: -1 }, ledgeY(42), tag);
    at(ctx, 'bassoonist', 100, { facing: 1 }, ledgeY(43), tag);
    yield ctx.waitCameraY(250);
    batsIn(ctx, 4, 'fly', tag);
    if (water instanceof RisingWater) water.setSpeed(WATER.finalSpeed, WATER.finalCap);
    yield* waitClearUp(ctx, tag);
    ctx.enableExit('summit');
    ctx.callout('TO THE SUMMIT ↑', { ticks: 90 });
  },
};

export const B2_IDS: readonly string[] = [
  'echo-bat', 'windup-bot', 'crate', 'metronome-turret', 'breakable-wall', 'pickup-gem', 'hostage', 'bassoonist', 'rifleman', 'cymbalist',
  'rising-water', 'icicle', 'baton-major',
];
