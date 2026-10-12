/**
 * m3-b1 — North Face (GDD §11.3): 384×1800, scroll up, checkpoints y 900, 400. The NORTH FACE ↑
 * route: a zig-zag of ice ledges up a cliff between two rock walls, a cable-car ride over the
 * smooth middle of the face (copters attack on the way), wind gusts that push everyone left, a
 * Helium Head secret niche with the golden record, and the summit fight; the top rect leads to
 * `c`.
 */
import type { Entity } from '../../../../engine/entity';
import type { ParticlePreset } from '../../../../engine/particles';
import { PAL } from '../../../../engine/palette';
import { pushX } from '../../../../engine/physics';
import type { ScriptGen } from '../../../../engine/script';
import { terrain, type DecorDef, type SectionContext, type SectionDef } from '../../../mission/index';
import { BG_NORTH_FACE } from './backgrounds';
import { at, crate, fromTop, hostage, normalUp, stageY, waitClearUp } from './helpers';

export const B1_W = 384;
export const B1_H = 1800;
export const FLOOR_Y = 1776;
/**
 * The cable car: a 64×8 cabin floor at x 250–314 rising to y 900. GDD: y 1400; moved up 8 px to
 * y 1392 (24 px over the k = 10 ledge instead of 16): the bot only climbs to goals > 20 px up.
 */
export const CAR = { x: 282, y: 1392, toY: 900 } as const;
/** Ledge y of stack index k (36 px apart). */
export const lowerY = (k: number): number => FLOOR_Y - 36 * k;
export const upperY = (k: number): number => CAR.toY - 36 * k;

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

const t = terrain(B1_W, B1_H);
t.ground().at(0, FLOOR_Y).flat(B1_W);
t.solid(0, 0, 24, B1_H, 'rock').solid(360, 0, 24, B1_H, 'rock');
// Lower stack: k = 1…10, odd k on the left, even k on the right.
for (let k = 1; k <= 10; k++) t.platform(k % 2 ? 24 : 184, lowerY(k), 176);
// Side ledges (enemy perches along the cable-car ride).
for (const y of [1300, 1150, 1000]) t.platform(24, y, 72);
// Upper stack: k = 1…24, odd k on the right, even k on the left.
for (let k = 1; k <= 24; k++) t.platform(k % 2 ? 184 : 24, upperY(k), 176);
// The secret niche (a Helium Head jump from the k = 9 ledge reaches it).
t.platform(24, 1380, 32);

const decor: DecorDef[] = [
  { sprite: 'decor/m3/pine', frame: 1, x: 56, y: FLOOR_Y },
  { sprite: 'decor/m3/pine', frame: 0, x: 120, y: FLOOR_Y },
  { sprite: 'decor/m3/pine', frame: 1, x: 330, y: FLOOR_Y },
  { sprite: 'decor/m3/pine', frame: 0, x: 60, y: 1000 },
  { sprite: 'decor/m3/pine', frame: 0, x: 336, y: upperY(15) },
];

// ---------------------------------------------------------------------------------------------
// Wind gusts
// ---------------------------------------------------------------------------------------------

/** Snow streaks blown across the view. */
const STREAK: ParticlePreset = {
  kind: 'rect',
  w: 5,
  h: 1,
  life: [40, 70],
  drag: 1,
  gravity: 0.005,
  colors: [PAL.snow[3], PAL.snow[2]],
  fadeFrom: 0.6,
  alpha: 0.85,
};

/** GDD: wind gusts every 480 ticks (every 360 above y 700): 60 ticks of streaks, then a push. */
export const GUST = { every: 480, everyHigh: 360, highY: 700, warn: 60, push: 120, speed: 0.4 } as const;

function* gusts(ctx: SectionContext): ScriptGen {
  const w = ctx.world;
  const cam = ctx.camera;
  const key = 'm3-b1-wind';
  try {
    for (;;) {
      yield cam.top <= GUST.highY ? GUST.everyHigh : GUST.every;
      w.audio.sfxLoop?.(key, 'env/wind', { vol: 0.5 });
      for (let i = 0; i < GUST.warn + GUST.push; i++) {
        const rng = w.fxRng;
        if (i % 2 === 0) w.particles.emit(STREAK, cam.right + 4, cam.top + rng.range(8, cam.h - 8), -rng.range(3, 5), rng.range(-0.2, 0.2));
        if (i >= GUST.warn) {
          for (const p of ctx.players) {
            if (p.alive && p.state === 'play') pushX(p, -GUST.speed, w.terrain, w);
          }
        }
        yield 1;
      }
      w.audio.stopSfx?.(key, 30);
    }
  } finally {
    w.audio.stopSfx?.(key, 10);
  }
}

// ---------------------------------------------------------------------------------------------
// The cable-car ride copters
// ---------------------------------------------------------------------------------------------

/** Hull centre at least this far above the highest living player's feet. */
const COPTER_ABOVE = 64;

/**
 * Keep the ride's copters above the players. A copter hovers 60–90 px over the floor under it,
 * and over the smooth face that floor is the view's bottom edge: it would hover at the height of
 * a player standing on the rising cable car, who cannot step aside (its contact kills). Held
 * above, it attacks with its downward note spreads and can be shot (up / up-diagonal).
 */
function* above(ctx: SectionContext, copters: readonly Entity[]): ScriptGen {
  for (;;) {
    let alive = 0;
    let top = Infinity;
    for (const p of ctx.players) if (p.alive && p.y < top) top = p.y;
    for (const c of copters) {
      if (!c.alive) continue;
      alive++;
      if (Number.isFinite(top) && c.y > top - COPTER_ABOVE) {
        c.y = top - COPTER_ABOVE;
        if (c.vy > 0) c.vy = 0;
      }
    }
    if (alive === 0 && copters.length >= 2) return;
    yield 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

export const sectionB1: SectionDef = {
  id: 'b1',
  name: 'North Face',
  width: B1_W,
  height: B1_H,
  scroll: 'up',
  background: BG_NORTH_FACE,
  terrain: t.build(),
  terrainStyle: { ground: 'rock', edge: 'snow', platform: 'ice', solid: 'rock' },
  decor,
  playerStart: { x: 192, y: FLOOR_Y },
  checkpoints: [900, 400],
  timeLimit: 60,
  exits: [{ id: 'summit', rect: { x: 140, y: 0, w: 104, h: 24 }, to: 'c', disabled: true }],
  *script(ctx) {
    ctx.showGo('up');
    ctx.spawn('cable-car', CAR.x, CAR.y, { toY: CAR.toY, speed: 0.5 });
    ctx.world.scripts.run(gusts(ctx));

    // Start: two riflemen on the first ledges.
    at(ctx, 'rifleman', 110, { facing: 1 }, lowerY(3));
    at(ctx, 'rifleman', 270, { facing: -1 }, lowerY(4));

    // Standing placements, staged just above the view's top edge.
    stageY(ctx, 1560, () => {
      at(ctx, 'ram-goat', 288, { facing: -1 }, 1560);
      crate(ctx, 96, 'bombs', 1596);
    });
    stageY(ctx, 1488, () => at(ctx, 'piccolo', 320, { facing: -1 }, 1488));
    stageY(ctx, 1452, () => ctx.spawn('helium-tank', 100, 1452));
    stageY(ctx, 1380, () => ctx.spawn('pickup-gem', 40, 1380, { kind: 'golden-record' }));
    stageY(ctx, 792, () => hostage(ctx, 'critic', 'chair', 300, 'L', 792));
    stageY(ctx, 756, () => {
      at(ctx, 'ram-goat', 100, { facing: 1 }, 756);
      at(ctx, 'ram-goat', 280, { facing: -1 }, 720);
    });
    stageY(ctx, 648, () => crate(ctx, 200, 'M', 648));
    stageY(ctx, 612, () => {
      at(ctx, 'piccolo', 60, { facing: 1 }, 612);
      at(ctx, 'piccolo', 330, { facing: -1 }, 576);
    });
    stageY(ctx, 540, () => hostage(ctx, 'tea-lady', 'chair', 120, 'auto', 540));
    // @400: the roadie's cage hangs under the k = 15 ledge and falls onto the ledge at y 432.
    stageY(ctx, 362, () => hostage(ctx, 'roadie', 'cage', 250, 'H', 400, { ropeTop: 362 }));

    // @1250: the cable-car ride — two copters from the sides, [N] two paratroopers.
    yield ctx.waitCameraY(1250);
    const copters = [ctx.enter('baton-copter', 'left', { y: ctx.camera.top + 40, margin: 32 })];
    ctx.world.scripts.run(above(ctx, copters));
    yield 90;
    copters.push(ctx.enter('baton-copter', 'right', { y: ctx.camera.top + 40, margin: 32 }));
    if (normalUp(ctx)) {
      yield 60;
      fromTop(ctx, 'rifleman', 60, { entry: 'parachute', facing: 1 });
      yield 40;
      fromTop(ctx, 'rifleman', 72, { entry: 'parachute', facing: 1 });
    }

    // @300: the summit ledges: a drum major, three riflemen and a bassoonist.
    yield ctx.waitCameraY(300 + 40);
    const tag = 'summit';
    at(ctx, 'baton-major', 120, { facing: 1 }, upperY(22), tag);
    at(ctx, 'rifleman', 250, { facing: -1 }, upperY(21), tag);
    at(ctx, 'rifleman', 90, { facing: 1 }, upperY(24), tag);
    at(ctx, 'rifleman', 290, { facing: -1 }, upperY(23), tag);
    at(ctx, 'bassoonist', 330, { facing: -1 }, upperY(21), tag);
    yield* waitClearUp(ctx, tag);
    ctx.enableExit('summit');
    ctx.callout('TO THE SUMMIT ↑', { ticks: 90 });
  },
};

export const B1_IDS: readonly string[] = [
  'cable-car', 'rifleman', 'ram-goat', 'crate', 'piccolo', 'helium-tank', 'pickup-gem', 'hostage', 'baton-copter', 'baton-major', 'bassoonist',
];
