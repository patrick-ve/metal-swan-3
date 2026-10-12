/**
 * Randomised physics check: bodies driven by random input over random terrain (with moving
 * dynamic solids) must never end a tick inside ground or a solid, never produce NaN, and stand on
 * a real surface when grounded. Seeded, so failures are reproducible (messages name seed + tick).
 */
import { describe, expect, it } from 'vitest';
import {
  type BodyOptions,
  type PhysicsEnv,
  SolidBox,
  SUPPORT_DYNAMIC,
  SUPPORT_GROUND,
  SUPPORT_PLATFORM,
  SUPPORT_SOLID,
  dropThrough,
  jump,
  moveBody,
  moveSolid,
} from '../../src/engine/physics';
import { Rng } from '../../src/engine/rng';
import { Terrain, terrain } from '../../src/engine/terrain';
import { mover, type TestMover } from './helpers';

function randomTerrain(rng: Rng): Terrain {
  const t = terrain(3000, 400);
  const g = t.ground().at(0, 300);
  while (g.x < 2900) {
    const k = rng.int(0, 9);
    const len = rng.int(16, 120);
    if (k < 3) g.flat(len);
    else if (k < 5) g.slope(len, rng.int(-len, len)); // walkable
    else if (k < 6) g.slope(rng.int(4, 20), rng.int(-60, 60)); // often too steep
    else if (k < 7) g.step(rng.int(-30, 30));
    else if (k < 8 && g.y < 360) g.gap(rng.int(20, 80));
    else g.hill(len, rng.int(-30, 30), 6);
    if (g.y < 120) g.step(40);
    if (g.y > 380) g.step(-40);
  }
  for (let i = 0; i < 25; i++) {
    const x = rng.int(0, 2800);
    const y = rng.int(100, 300);
    if (rng.chance(0.5)) t.platform(x, y, rng.int(30, 150));
    else t.platforms().at(x, y).slope(rng.int(30, 120), rng.int(-50, 50));
  }
  for (let i = 0; i < 25; i++) t.solid(rng.int(0, 2800), rng.int(60, 330), rng.int(4, 80), rng.int(4, 60));
  return new Terrain(t.build());
}

/** Where is the body overlapping something solid? null when it fits. */
function penetration(t: Terrain, m: TestMover, env: PhysicsEnv): string | null {
  const b = m.body;
  const g = t.groundY(m.x);
  if (m.y > g + 1e-6) return `feet below ground (${m.y} > ${g})`;
  const x0 = m.x - b.w / 2 + 0.01;
  const x1 = m.x + b.w / 2 - 0.01;
  const top = m.y - b.h + 0.01;
  const low = m.y - b.stepUp - 0.01;
  for (const s of t.solids) {
    if (x0 < s.x + s.w && x1 > s.x && top < s.y + s.h && low > s.y) return `inside solid ${JSON.stringify(s)}`;
  }
  for (const s of env.solids) {
    if (s.oneWay) continue;
    if (x0 < s.x + s.w && x1 > s.x && top < s.y + s.h && low > s.y) return `inside dynamic ${JSON.stringify(s)}`;
  }
  return null;
}

const SHAPES: Array<Partial<BodyOptions>> = [
  {}, // 14×30 soldier
  { w: 40, h: 24 }, // vehicle
  { w: 6, h: 6, bounce: 0.4, groundFriction: 0.9 }, // grenade
];

function run(seed: number, shape: Partial<BodyOptions>, ticks: number): void {
  const rng = new Rng(seed);
  const t = randomTerrain(rng);
  // Moving platforms: one-way lifts and solid sliding blocks.
  const boxes: SolidBox[] = [];
  const paths: Array<{ box: SolidBox; dx: number; dy: number; period: number }> = [];
  for (let i = 0; i < 6; i++) {
    const oneWay = i % 2 === 0;
    const box = new SolidBox(rng.int(100, 2800), rng.int(120, 280), rng.int(24, 80), oneWay ? 8 : rng.int(8, 30), oneWay);
    boxes.push(box);
    paths.push({ box, dx: rng.pick([0, 0.5, 1]), dy: rng.pick([0, -0.5, 0.5, 1]), period: rng.int(60, 240) });
  }
  const env: PhysicsEnv = { solids: boxes };
  const m = mover(rng.int(50, 2900), 50, shape);
  const movers = [m];
  let vx = 0;
  for (let tick = 0; tick < ticks; tick++) {
    m.crushed = 0;
    for (const p of paths) {
      const dir = Math.floor(tick / p.period) % 2 === 0 ? 1 : -1;
      moveSolid(p.box, p.dx * dir, p.dy * dir, movers, t, env);
    }
    if (rng.chance(0.03)) vx = rng.pick([-3, -1.45, -0.7, 0, 0.7, 1.45, 3, 8]);
    if (rng.chance(0.02) && m.body.ticksSinceGrounded < 5) jump(m, -4.6);
    if (rng.chance(0.005)) dropThrough(m);
    if (!shape.bounce) m.vx = vx;
    else if (rng.chance(0.01)) {
      m.vx = rng.range(-4, 4);
      m.vy = rng.range(-6, 0);
      m.body.onGround = false;
    }
    moveBody(m, t, env);
    const where = `seed ${seed} w${m.body.w} tick ${tick} at (${m.x.toFixed(2)}, ${m.y.toFixed(2)})`;
    expect(Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.vx) && Number.isFinite(m.vy), where).toBe(true);
    if (m.crushed === 0) expect(penetration(t, m, env), where).toBeNull();
    if (m.body.onGround) {
      const s = m.body.support;
      if (s === SUPPORT_GROUND) {
        // On the ground under the feet centre, or bridging a gap narrower than the body.
        let g = t.groundY(m.x);
        const r = { lx: 0, ly: 0, rx: 0, ry: 0 };
        if (g === Infinity && t.pitRims(m.x, m.body.w - 2, r)) g = Math.min(r.ly, r.ry);
        expect(Math.abs(g - m.y), where).toBeLessThan(1e-6);
      }
      if (s === SUPPORT_PLATFORM) expect(t.platformY(m.x, m.y - 0.001, m.y + 0.001), where).toBeCloseTo(m.y, 6);
      if (s === SUPPORT_SOLID) expect(t.solids.some((r) => Math.abs(r.y - m.y) < 1e-9), where).toBe(true);
      if (s === SUPPORT_DYNAMIC) expect(Math.abs((m.body.supportSolid?.y ?? NaN) - m.y), where).toBeLessThan(1e-6);
    }
    if (m.y > t.killY || m.crushed > 0) {
      m.x = rng.int(50, 2900);
      m.y = 50;
      m.vx = m.vy = 0;
      m.body.onGround = false;
      m.body.supportSolid = null;
    }
  }
}

describe('physics fuzz', () => {
  for (const shape of SHAPES) {
    const label = shape.w ? `${shape.w}x${shape.h}${shape.bounce ? ' bouncing' : ''}` : 'soldier';
    it(`${label}: no penetration, no NaN, grounded means supported (20 seeds)`, () => {
      for (let seed = 1; seed <= 20; seed++) run(seed, shape, 4000);
    });
  }
});
