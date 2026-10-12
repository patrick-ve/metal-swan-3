/**
 * m4-c1 — The Underground (lower route; GDD §11.4): 2400×216, scroll right, checkpoint 1000.
 *
 * A Legion metro station: the track bed at y 192, a tiled ceiling (solid y 0–40), three station
 * platforms (one-way `metal`, y 152) with gaps that must be crossed on the track bed, two
 * `subway-train`s (a moving kill zone 400×40 on the track; the platforms are safe), ticket
 * inspectors (`usher-bot`), ceiling turrets and the end lock (2016–2400). The stairs up at the
 * right end lead to `d`.
 *
 * Layout notes (reported): each platform end has a one-way stair step (24 wide, y 172) down to the
 * track, so climbing back up is two short hops (20 px each) instead of one 40 px jump.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { BG_SUBWAY } from './backgrounds';
import type { Entity } from '../../../../engine/entity';
import type { SpawnParams } from '../../../registry';
import { at, stage } from './helpers';

export const C1_W = 2400;
/** The track bed and the platform line. */
export const TRACK_Y = 192;
export const PLATFORM_Y = 152;
const CEILING_Y = 40;
/** Station platforms [x0, x1]. */
export const C1_PLATFORMS = [
  [0, 640],
  [760, 1400],
  [1520, 2400],
] as const;
/** The end lock. */
export const C1_ARENA = { x0: 2016, x1: 2400 } as const;

const t = terrain(C1_W, 216);
t.ground().at(0, TRACK_Y).flat(C1_W);
t.solid(0, 0, C1_W, CEILING_Y, 'concrete');
for (const [x0, x1] of C1_PLATFORMS) t.platform(x0, PLATFORM_Y, x1 - x0);
// Stair steps down to the track at the gap ends.
for (const x of [640, 736, 1400, 1496]) t.platform(x, 172, 24);

const decor: DecorDef[] = [
  ...Array.from({ length: 8 }, (_, i): DecorDef => ({ sprite: 'decor/m4/pillar', x: 152 + i * 320, y: CEILING_Y })),
  ...[260, 1040, 1800, 2200].map((x): DecorDef => ({ sprite: 'decor/m4/bench', x, y: PLATFORM_Y })),
  { sprite: 'decor/m4/stairs-up', x: 2358, y: PLATFORM_Y },
  { sprite: 'decor/m4/sign', frame: 4, x: 2330, y: PLATFORM_Y },
];

export const sectionC1: SectionDef = {
  id: 'c1',
  name: 'The Underground',
  width: C1_W,
  height: 216,
  scroll: 'right',
  background: BG_SUBWAY,
  terrain: t.build(),
  terrainStyle: { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'concrete' },
  decor,
  playerStart: { x: 48, y: PLATFORM_Y },
  checkpoints: [1000],
  timeLimit: 60,
  // A respawn over the track bed lands on the nearest station platform instead (the trains).
  respawn: (p, ctx) => {
    for (const [x0, x1] of C1_PLATFORMS) if (p.x >= x0 && p.x <= x1) return { x: p.x, y: PLATFORM_Y };
    const x = p.x < 700 ? 620 : p.x < 1460 ? (p.x < 1080 ? 780 : 1380) : 1540;
    return { x: Math.max(ctx.camera.left + 24, Math.min(ctx.camera.right - 24, x)), y: PLATFORM_Y };
  },
  exits: [{ id: 'stairs', rect: { x: 2380, y: 100, w: 20, h: 54 }, to: 'd', disabled: true }],
  *script(ctx) {
    if (!ctx.bossRush) yield* station(ctx);
    yield ctx.waitCamera(C1_ARENA.x0);
    ctx.lockCamera(C1_ARENA.x0, C1_ARENA.x1);
    for (const x of [2160, 2300]) at(ctx, 'usher-bot', x, { facing: -1, patrol: 48, tag: 'end' }, PLATFORM_Y);
    for (let i = 0; i < 3; i++) {
      fromRight(ctx, 'rifleman', {}, 'end');
      yield 30;
    }
    fromRight(ctx, 'drummer', {}, 'end');
    yield 30;
    yield ctx.waitClear('end');
    ctx.unlockCamera();
    ctx.enableExit('stairs');
  },
};

/** The floor under x: a station platform, else the track bed. */
function floorAt(x: number): number {
  for (const [x0, x1] of C1_PLATFORMS) if (x >= x0 && x <= x1) return PLATFORM_Y;
  return TRACK_Y;
}

/**
 * `R+16` underground: just outside the right view edge on the floor there (the generic side
 * entry would search down from the view top and find the ceiling).
 */
function fromRight(ctx: SectionContext, id: string, params?: SpawnParams, tag?: string): Entity {
  const x = Math.min(ctx.camera.right + 16, C1_W - 8);
  return at(ctx, id, x, { facing: -1, enter: 'right', ...params, ...(tag ? { tag } : {}) }, floorAt(x));
}

/** A train with the GDD telegraph (sparks, headlight, DING DING for 120 ticks). */
function train(ctx: SectionContext, from: 'left' | 'right'): void {
  ctx.spawn('subway-train', 0, TRACK_Y, { from });
}

/** The station rows (skipped with ?boss=1). */
function* station(ctx: SectionContext): ScriptGen {
  // @0: two ticket inspectors; two riflemen wait for a train behind their newspapers.
  at(ctx, 'usher-bot', 180, { patrol: 60, facing: -1 }, PLATFORM_Y);
  at(ctx, 'usher-bot', 520, { patrol: 60, facing: -1 }, PLATFORM_Y);
  for (const x of [300, 340]) at(ctx, 'rifleman', x, { gag: 'newspaper', facing: -1 }, PLATFORM_Y);
  // @300: ceiling turrets and a crate.
  stage(ctx, 450, () => {
    ctx.spawn('metronome-turret', 450, CEILING_Y);
    at(ctx, 'crate', 520, { contains: 'F' }, PLATFORM_Y);
  });
  stage(ctx, 600, () => ctx.spawn('metronome-turret', 600, CEILING_Y));
  // @600: a critic on a chair.
  stage(ctx, 820, () => at(ctx, 'hostage', 820, { kind: 'critic', bind: 'chair', drop: 'B' }, PLATFORM_Y));
  // @1300: a tourist in a sack; a turret.
  stage(ctx, 1500, () => ctx.spawn('metronome-turret', 1500, CEILING_Y));
  stage(ctx, 1600, () => at(ctx, 'hostage', 1600, { kind: 'tourist', bind: 'sack', drop: 'auto' }, PLATFORM_Y));
  // @1600 (staged): a bassoonist on a bench.
  stage(ctx, 1800, () => at(ctx, 'bassoonist', 1800, { facing: -1 }, PLATFORM_Y));

  // @800 TRAIN from the right; afterwards three riflemen stand on the platform.
  yield ctx.waitCamera(800);
  train(ctx, 'right');
  yield 120 + 120;
  for (const x of [1100, 1150, 1200]) {
    if (x > ctx.camera.right + 8) fromRight(ctx, 'rifleman');
    else at(ctx, 'rifleman', x, { facing: -1, entry: 'drop' }, PLATFORM_Y);
    yield 20;
  }

  // @1000: three inspectors and four wind-up bots.
  yield ctx.waitCamera(1000);
  for (const x of [1300, 1340, 1380]) {
    if (x > ctx.camera.right + 8) fromRight(ctx, 'usher-bot', { patrol: 40 });
    else at(ctx, 'usher-bot', x, { patrol: 40, facing: -1 }, PLATFORM_Y);
  }
  const x0 = Math.min(ctx.camera.right + 16, C1_W - 90);
  for (let i = 0; i < 4; i++) at(ctx, 'windup-bot', x0 + i * 20, { facing: -1 }, PLATFORM_Y);

  // @1600 TRAIN from the left.
  yield ctx.waitCamera(1600);
  train(ctx, 'left');
}

/** Every entity id this section spawns (tests). */
export const C1_IDS = ['usher-bot', 'rifleman', 'metronome-turret', 'crate', 'hostage', 'bassoonist', 'subway-train', 'windup-bot', 'drummer'] as const;
