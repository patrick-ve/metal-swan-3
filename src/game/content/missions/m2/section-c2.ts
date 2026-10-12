/**
 * m2-c2 — Mesa Top, the upper route (GDD §11.2): 2200×216, scroll right, checkpoint 1000,
 * vehicles allowed: `sundae-driver`.
 *
 * Mesa tops at y 150 joined by three rope bridges (one-way `wood` platforms, so vehicles never
 * fall); under every bridge a Legion training net (`spring-awning`, variant `net`) bounces a
 * falling player back up. Air enemies (baton-copters, piano-bombers), parachutists, a caged
 * critic under a signpost and a closing lock before the ramp down into the quarry (`d`).
 *
 * Layout notes (reported): each gap holds several 48 px nets side by side (one net is narrower
 * than a gap); the pit hazard under them sits at y 204 so a player on a net (y 206) is never
 * inside it (arsenal.md: hazard top ≥ awning y − 3). Wind streaks are cosmetic particles.
 */
import type { ScriptGen } from '../../../../engine/script';
import type { ParticlePreset } from '../../../../engine/particles';
import { PAL } from '../../../../engine/palette';
import type { DecorDef, SectionContext, SectionDef } from '../../../mission/index';
import { terrain } from '../../../mission/index';
import { BRIDGE_WIDTHS, SIGN, SIGNPOST_ARM } from './art';
import { BG_MESA } from './backgrounds';
import { at, fromLeft, fromRight, fromTop, normalUp, stage, VAN } from './helpers';

export const C2_W = 2200;
/** The mesa top line. */
export const MESA = 150;
/** The gaps under the rope bridges, [x0, x1]. */
export const C2_GAPS: readonly (readonly [number, number])[] = [
  [420, 560],
  [1100, 1260],
  [1500, 1640],
];
/** The training nets' bounce surface. */
const NET_Y = 206;
const LOCK_X = 1816;
/** The signpost that holds the critic's cage (arm tip x; arm y = MESA − SIGNPOST_ARM = 80). */
const POST_X = 1450;

const t = terrain(C2_W, 216);
{
  const g = t.ground().at(0, MESA);
  let x = 0;
  for (const [x0, x1] of C2_GAPS) {
    g.flat(x0 - x).gap(x1 - x0);
    x = x1;
  }
  g.flat(C2_W - x);
}
for (const [x0, x1] of C2_GAPS) {
  t.platform(x0, MESA, x1 - x0);
  t.hazard('pit', x0, NET_Y - 2, x1 - x0, 48);
}

const decor: DecorDef[] = [{ sprite: 'decor/m2/skull', x: 300, y: MESA }];
for (const [x0, x1] of C2_GAPS) {
  decor.push({ sprite: 'decor/m2/bridge', frame: Math.max(0, BRIDGE_WIDTHS.indexOf((x1 - x0) as 140 | 160)), x: x0, y: MESA });
  decor.push({ sprite: 'decor/m2/bridge-post', x: x0 + 3, y: MESA });
  decor.push({ sprite: 'decor/m2/bridge-post', x: x1 - 3, y: MESA, flipX: true });
  decor.push({ sprite: 'decor/m2/net-pole', x: x0 + 4, y: 216 });
  decor.push({ sprite: 'decor/m2/net-pole', x: x1 - 4, y: 216 });
}
decor.push(
  { sprite: 'decor/m2/cactus', x: 760, y: MESA },
  { sprite: 'decor/m2/signpost', x: POST_X, y: MESA },
  { sprite: 'decor/m2/cactus', x: 1960, y: MESA },
  { sprite: 'decor/m2/sign', frame: SIGN.quarry, x: 2150, y: MESA },
);

/** Thin white wind streaks blowing across the mesa (cosmetic, world.fxRng). */
const STREAK: ParticlePreset = { kind: 'rect', w: 10, h: 1, life: [40, 70], colors: [PAL.snow[3], PAL.snow[2]], alpha: 0.55, fadeFrom: 0.5 };

function* wind(ctx: SectionContext): ScriptGen {
  const w = ctx.world;
  for (;;) {
    const cam = ctx.camera;
    w.particles.emit(STREAK, cam.right + 8, cam.top + w.fxRng.range(12, 140), -w.fxRng.range(5, 7), w.fxRng.range(-0.1, 0.1));
    yield w.fxRng.int(6, 14);
  }
}

/** Nets under every bridge: as many 48 px nets as the gap needs, evenly spaced. */
function nets(ctx: SectionContext): void {
  for (const [x0, x1] of C2_GAPS) {
    const n = Math.ceil((x1 - x0) / 46);
    const step = (x1 - x0 - 48) / (n - 1);
    for (let i = 0; i < n; i++) ctx.spawn('spring-awning', Math.round(x0 + 24 + i * step), NET_Y, { variant: 'net', w: 48 });
  }
}

export const sectionC2: SectionDef = {
  id: 'c2',
  name: 'Mesa Top',
  width: C2_W,
  height: 216,
  scroll: 'right',
  background: BG_MESA,
  terrain: t.build(),
  terrainStyle: { ground: 'rock', edge: 'sand', platform: 'wood', solid: 'rock' },
  decor,
  playerStart: { x: 48, y: MESA },
  checkpoints: [1000],
  timeLimit: 60,
  vehicles: [VAN],
  exits: [{ id: 'east', rect: { x: C2_W - 20, y: 0, w: 20, h: 216 }, to: 'd', disabled: true }],
  *script(ctx) {
    ctx.world.scripts.run(wind(ctx));
    nets(ctx);
    // Standing placements of the rows, staged just before they scroll into view.
    stage(ctx, 520, () => {
      at(ctx, 'triangle', 520, { gag: 'counting', facing: -1 }, MESA);
      for (const x of [600, 650, 700]) at(ctx, 'rifleman', x, { facing: -1 }, MESA);
    });
    stage(ctx, 640, () => at(ctx, 'crate', 640, { contains: 'H' }, MESA));
    stage(ctx, 800, () => {
      at(ctx, 'hostage', 800, { kind: 'tourist', bind: 'sack', drop: 'auto' }, MESA);
      at(ctx, 'bassoonist', 900, { facing: -1 }, MESA);
      at(ctx, 'bassoonist', 960, { facing: -1 }, MESA);
    });
    // The critic in a cage under the signpost (rope top y 80), staged before the post shows.
    stage(ctx, POST_X - 40, () => {
      const armY = MESA - SIGNPOST_ARM;
      at(ctx, 'hostage', POST_X, { kind: 'critic', bind: 'cage', ropeTop: armY + 2, drop: 'M' }, armY + 46);
    });
    fromRight(ctx, 'baton-copter', undefined, 32);
    at(ctx, 'crate', 200, { contains: 'bombs' }, MESA);

    yield ctx.waitCamera(400);
    ctx.enter('piano-bomber', 'right', { y: 32, params: { pianos: 3 } });

    yield ctx.waitCamera(1000);
    fromRight(ctx, 'baton-copter', undefined, 32);
    if (normalUp(ctx)) {
      yield 90;
      fromRight(ctx, 'baton-copter', undefined, 32);
    }

    yield ctx.waitCamera(1500);
    fromLeft(ctx, 'piano-bomber', { pianos: 3 }, 48);
    for (const x of [1700, 1760, 1820, 1880]) {
      fromTop(ctx, 'rifleman', x, { entry: 'parachute' });
      yield 14;
    }

    yield ctx.waitCamera(LOCK_X);
    ctx.lockCamera(LOCK_X, C2_W);
    fromRight(ctx, 'baton-copter', undefined, 32, 'ambush');
    yield 40;
    fromRight(ctx, 'cymbalist', undefined, 16, 'ambush');
    yield 30;
    fromRight(ctx, 'rifleman', undefined, 16, 'ambush');
    yield 60;
    fromRight(ctx, 'baton-copter', undefined, 32, 'ambush');
    yield 30;
    fromRight(ctx, 'cymbalist', undefined, 16, 'ambush');
    yield 30;
    fromRight(ctx, 'rifleman', undefined, 16, 'ambush');
    yield ctx.waitClear('ambush');
    ctx.unlockCamera();
    ctx.enableExit('east');
    ctx.showGo();
  },
};
