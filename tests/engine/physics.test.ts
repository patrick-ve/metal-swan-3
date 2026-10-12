import { describe, expect, it } from 'vitest';
import {
  Body,
  SolidBox,
  SUPPORT_DYNAMIC,
  SUPPORT_GROUND,
  SUPPORT_PLATFORM,
  SUPPORT_SOLID,
  displace,
  dropThrough,
  jump,
  moveBody,
  moveSolid,
  settle,
  sweep,
  type PhysicsEnv,
} from '../../src/engine/physics';
import { Terrain, terrain } from '../../src/engine/terrain';
import { mover, type TestMover } from './helpers';

const FLOOR = 170;

function flat(extra?: (t: ReturnType<typeof terrain>) => void): Terrain {
  const t = terrain(2000, 216);
  t.ground().at(0, FLOOR).flat(2000);
  extra?.(t);
  return new Terrain(t.build());
}

/** Run `ticks` ticks with a constant vx; returns per-tick snapshots. */
function walk(m: TestMover, terr: Terrain, vx: number, ticks: number, env?: PhysicsEnv) {
  const out: Array<{ x: number; y: number; onGround: boolean }> = [];
  for (let i = 0; i < ticks; i++) {
    m.vx = vx;
    moveBody(m, terr, env);
    out.push({ x: m.x, y: m.y, onGround: m.body.onGround });
  }
  return out;
}

describe('physics: ground', () => {
  it('walks on flat ground without leaving it', () => {
    const t = flat();
    const m = mover(100, FLOOR);
    settle(m, t);
    const log = walk(m, t, 1.45, 100);
    expect(log.every((s) => s.onGround && s.y === FLOOR)).toBe(true);
    expect(m.x).toBeCloseTo(100 + 145, 6);
    expect(m.body.support).toBe(SUPPORT_GROUND);
  });

  it('lands on the ground when falling from above (once)', () => {
    const t = flat();
    const m = mover(100, 60);
    let landed = 0;
    for (let i = 0; i < 120; i++) if (moveBody(m, t).landed) landed++;
    expect(landed).toBe(1);
    expect(m.y).toBe(FLOOR);
    expect(m.vy).toBe(0);
    expect(m.body.onGround).toBe(true);
  });

  it('follows a gentle slope up and down with no airborne tick', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 200).flat(200).slope(200, -60).flat(100).slope(200, 60).flat(400);
    const t = new Terrain(def.build());
    const m = mover(100, 200);
    settle(m, t);
    // Right across the hill (x 100 → 535 → 805), then back left (805 → 370).
    for (const [vx, ticks] of [
      [1.45, 300],
      [3, 90],
      [-1.45, 300],
    ]) {
      for (let i = 0; i < ticks; i++) {
        m.vx = vx;
        moveBody(m, t);
        expect(m.body.onGround).toBe(true);
        expect(m.y).toBeCloseTo(t.groundY(m.x), 9);
      }
    }
  });

  it('walks a 1:1 slope up and down continuously', () => {
    const def = terrain(2000, 400);
    def.ground().at(0, 300).flat(200).slope(150, -150).flat(100).slope(150, 150).flat(400);
    const t = new Terrain(def.build());
    const m = mover(150, 300);
    settle(m, t);
    for (let i = 0; i < 400; i++) {
      m.vx = 1.45;
      moveBody(m, t);
      expect(m.body.onGround).toBe(true);
      expect(m.y).toBeCloseTo(t.groundY(m.x), 9);
    }
    expect(m.x).toBeGreaterThan(700); // crossed the whole hill
    for (let i = 0; i < 250; i++) {
      m.vx = -2.5;
      moveBody(m, t);
      expect(m.body.onGround).toBe(true);
      expect(m.y).toBeCloseTo(t.groundY(m.x), 9);
    }
  });

  it('treats ground steeper than maxSlope as a wall', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 200).flat(300).slope(40, -80).flat(300);
    const t = new Terrain(def.build());
    const m = mover(200, 200);
    settle(m, t);
    let hitWall = false;
    for (let i = 0; i < 200; i++) {
      m.vx = 1.45;
      if (moveBody(m, t).hitWall) hitWall = true;
    }
    expect(hitWall).toBe(true);
    expect(m.y).toBe(200); // never climbed
    // The leading edge stops where the steep face crosses the step-up line (4 px up the face).
    expect(m.x + 7).toBeCloseTo(300 + 2, 6);
  });

  it('steps up small steps but not tall ones', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 200).flat(300).step(-3).flat(200).step(-12).flat(300);
    const t = new Terrain(def.build());
    const m = mover(250, 200);
    settle(m, t);
    walk(m, t, 1.45, 200);
    expect(m.y).toBe(197); // climbed the 3 px step
    expect(m.x + 7).toBeCloseTo(500, 6); // stopped at the 12 px step
    expect(m.body.contact.hitWall).toBe(true);
  });

  it('walks off a ledge, counts ticks since grounded, then lands below', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 150).flat(300).step(50).flat(500);
    const t = new Terrain(def.build());
    const m = mover(290, 150);
    settle(m, t);
    let left = -1;
    for (let i = 0; i < 40; i++) {
      m.vx = 1.45;
      const c = moveBody(m, t);
      if (c.leftGround && left < 0) left = i;
      if (left >= 0 && !c.onGround && i - left < 5) expect(m.body.ticksSinceGrounded).toBe(i - left + 1);
    }
    expect(left).toBeGreaterThanOrEqual(0);
    expect(m.y).toBe(200);
    expect(m.body.onGround).toBe(true);
  });

  it('a body in a pit is walled in by the polyline ends', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 150).flat(300).gap(100).flat(300);
    const t = new Terrain(def.build());
    const m = mover(350, 250, { maxFall: 2 });
    for (let i = 0; i < 100; i++) {
      m.vx = 2;
      moveBody(m, t);
    }
    expect(m.x + 7).toBeCloseTo(400, 6);
    for (let i = 0; i < 100; i++) {
      m.vx = -2;
      moveBody(m, t);
    }
    expect(m.x - 7).toBeCloseTo(300, 6);
  });
});

describe('physics: jumping, platforms, ceilings', () => {
  it('jumps through a one-way platform from below and lands on it', () => {
    const t = flat((d) => d.platform(0, 135, 600));
    const m = mover(100, FLOOR);
    settle(m, t);
    jump(m, -4.6);
    let minY = Infinity;
    for (let i = 0; i < 80; i++) {
      moveBody(m, t);
      minY = Math.min(minY, m.y);
    }
    expect(minY).toBeLessThan(135);
    expect(m.y).toBe(135);
    expect(m.body.support).toBe(SUPPORT_PLATFORM);
  });

  it('a too-short jump falls back through the platform', () => {
    const t = flat((d) => d.platform(0, 100, 600));
    const m = mover(100, FLOOR);
    settle(m, t);
    jump(m, -4.6); // apex ~48 px: feet reach ~122, below the platform at 100
    for (let i = 0; i < 80; i++) moveBody(m, t);
    expect(m.y).toBe(FLOOR);
  });

  it('drops through a platform with dropThrough, but never through ground', () => {
    const t = flat((d) => d.platform(0, 130, 600).platform(0, 140, 50));
    const m = mover(100, 130);
    settle(m, t);
    expect(m.body.onOneWay).toBe(true);
    expect(dropThrough(m)).toBe(true);
    for (let i = 0; i < 60; i++) moveBody(m, t);
    expect(m.y).toBe(FLOOR);
    expect(m.body.support).toBe(SUPPORT_GROUND);
    expect(dropThrough(m)).toBe(false);
    for (let i = 0; i < 30; i++) moveBody(m, t);
    expect(m.y).toBe(FLOOR);
  });

  it('dropping still lands on a platform that is clearly lower', () => {
    const t = flat((d) => d.platform(0, 100, 600).platform(0, 112, 600));
    const m = mover(100, 100);
    settle(m, t);
    dropThrough(m);
    for (let i = 0; i < 40; i++) moveBody(m, t);
    expect(m.y).toBe(112);
  });

  it('walks along a sloped one-way platform', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 250).flat(2000);
    def.platforms().at(100, 200).flat(100).slope(100, -50).flat(100);
    const t = new Terrain(def.build());
    const m = mover(120, 200);
    settle(m, t);
    for (let i = 0; i < 150; i++) {
      m.vx = 1.45;
      moveBody(m, t);
      expect(m.body.onGround).toBe(true);
      expect(m.y).toBeCloseTo(t.platformY(m.x, m.y - 1, m.y + 1), 9);
    }
    expect(m.y).toBe(150);
    // Walking off the far end falls to the ground.
    for (let i = 0; i < 200; i++) {
      m.vx = 1.45;
      moveBody(m, t);
    }
    expect(m.y).toBe(250);
  });

  it('walks up onto a ramp platform that starts at ground level', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 200).flat(2000);
    def.platforms().at(300, 200).slope(100, -60).flat(100);
    const t = new Terrain(def.build());
    const m = mover(250, 200);
    settle(m, t);
    walk(m, t, 1.45, 120);
    expect(m.y).toBe(140);
    expect(m.body.support).toBe(SUPPORT_PLATFORM);
  });

  it('stops at ceilings (solid rect bottoms)', () => {
    const t = flat((d) => d.solid(50, 100, 100, 20));
    const m = mover(100, FLOOR);
    settle(m, t);
    jump(m, -4.6);
    let bonk = false;
    for (let i = 0; i < 60; i++) if (moveBody(m, t).hitCeiling) bonk = true;
    expect(bonk).toBe(true);
    expect(m.y).toBe(FLOOR);
  });

  it('ceiling clamps the head exactly', () => {
    const t = flat((d) => d.solid(50, 120, 100, 10));
    const m = mover(100, FLOOR);
    settle(m, t);
    jump(m, -4.6);
    let topY = Infinity;
    for (let i = 0; i < 60; i++) {
      moveBody(m, t);
      topY = Math.min(topY, m.y - m.body.h);
    }
    expect(topY).toBeCloseTo(130, 9);
  });
});

describe('physics: solid rects', () => {
  it('rect sides are walls; low rects are stepped onto', () => {
    const t = flat((d) => d.solid(300, 150, 100, 20).solid(500, 167, 40, 3));
    const m = mover(200, FLOOR);
    settle(m, t);
    walk(m, t, 1.45, 150);
    expect(m.x + 7).toBeCloseTo(300, 6);
    expect(m.body.contact.hitWall).toBe(true);
    // Jump onto the tall block, then walk on to the low one.
    jump(m, -4.6);
    for (let i = 0; i < 60; i++) {
      m.vx = 1.45;
      moveBody(m, t);
    }
    expect(m.y).toBe(150);
    expect(m.body.support).toBe(SUPPORT_SOLID);
    // Walk off the block, down to the floor, and up the 3 px curb (500..540).
    for (let i = 0; i < 300 && m.x < 520; i++) {
      m.vx = 1.45;
      moveBody(m, t);
    }
    expect(m.y).toBe(167);
    expect(m.body.support).toBe(SUPPORT_SOLID);
  });

  it('box support uses the whole body width', () => {
    const t = flat((d) => d.solid(100, 140, 40, 30));
    const m = mover(120, 100);
    for (let i = 0; i < 60; i++) moveBody(m, t);
    expect(m.y).toBe(140);
    walk(m, t, 1, 26); // centre now past the edge, side still over it
    expect(m.x).toBeGreaterThan(140);
    expect(m.y).toBe(140);
    walk(m, t, 1, 10);
    expect(m.body.onGround).toBe(false);
  });
});

describe('physics: speed and tunnelling', () => {
  it('never tunnels through thin geometry at 16 px/tick', () => {
    const def = terrain(4000, 600);
    def.ground().at(0, 500).flat(4000);
    def.platform(0, 300, 4000);
    def.solid(1000, 0, 2, 500);
    const t = new Terrain(def.build());
    // Vertical: falls at 16 px/tick onto a zero-thickness platform.
    const a = mover(100, 0, { maxFall: 16 });
    a.vy = 16;
    for (let i = 0; i < 40; i++) moveBody(a, t);
    expect(a.y).toBe(300);
    // Horizontal: 16 px/tick into a 2 px wide wall.
    const b = mover(900, 500);
    settle(b, t);
    for (let i = 0; i < 40; i++) {
      b.vx = 16;
      moveBody(b, t);
    }
    expect(b.x + 7).toBeCloseTo(1000, 6);
    // Diagonal into the ground at a shallow angle.
    const c = mover(100, 480, { maxFall: 16 });
    for (let i = 0; i < 40; i++) {
      c.vx = 16;
      c.vy = 16;
      moveBody(c, t);
      expect(c.y).toBeLessThanOrEqual(500);
    }
  });

  it('a body without collision only integrates', () => {
    const t = flat();
    const m = mover(100, 160, { collide: false, gravity: 0 });
    m.vx = 3;
    m.vy = 2;
    for (let i = 0; i < 10; i++) moveBody(m, t);
    expect(m.x).toBe(130);
    expect(m.y).toBe(180);
  });

  it('bouncing bodies lose energy and settle', () => {
    const t = flat();
    const m = mover(100, 80, { w: 4, h: 4, bounce: 0.5, groundFriction: 0.8 });
    m.vx = 2;
    let bounces = 0;
    for (let i = 0; i < 300; i++) if (moveBody(m, t).bounced) bounces++;
    expect(bounces).toBeGreaterThan(0);
    expect(m.body.onGround).toBe(true);
    expect(m.y).toBe(FLOOR);
    expect(Math.abs(m.vx)).toBeLessThan(0.01);
  });
});

describe('physics: dynamic solids', () => {
  function env(...boxes: SolidBox[]): PhysicsEnv {
    return { solids: boxes };
  }

  it('stands on a dynamic box and is carried horizontally and vertically', () => {
    const t = flat();
    const box = new SolidBox(80, 120, 60, 10, true);
    const e = env(box);
    const m = mover(100, 100);
    for (let i = 0; i < 40; i++) moveBody(m, t, e);
    expect(m.y).toBe(120);
    expect(m.body.support).toBe(SUPPORT_DYNAMIC);
    for (let i = 0; i < 50; i++) {
      moveSolid(box, 1, -0.5, [m], t, e);
      moveBody(m, t, e);
      expect(m.body.onGround).toBe(true);
      expect(m.y).toBeCloseTo(box.y, 9);
    }
    expect(m.x).toBeCloseTo(150, 6);
    expect(m.y).toBeCloseTo(95, 6);
    // Same when the rider updates before the platform moves.
    for (let i = 0; i < 20; i++) {
      moveBody(m, t, e);
      moveSolid(box, -1, 0.5, [m], t, e);
      expect(m.y).toBeCloseTo(box.y, 9);
    }
  });

  it('a solid box blocks like a rect and pushes bodies it runs into', () => {
    const t = flat();
    const box = new SolidBox(200, 130, 30, 40);
    const e = env(box);
    const m = mover(150, FLOOR);
    settle(m, t, e);
    walk(m, t, 2, 40, e);
    expect(m.x + 7).toBeCloseTo(200, 6);
    // Box moves left into the body: the body is pushed.
    for (let i = 0; i < 10; i++) moveSolid(box, -2, 0, [m], t, e);
    expect(m.x + 7).toBeCloseTo(box.x, 6);
    expect(m.crushed).toBe(0);
  });

  it('crushes a body pushed against a wall', () => {
    const t = flat((d) => d.solid(100, 100, 20, 70));
    const box = new SolidBox(200, 130, 30, 40);
    const e = env(box);
    const m = mover(130, FLOOR);
    settle(m, t, e);
    for (let i = 0; i < 40; i++) moveSolid(box, -2, 0, [m], t, e);
    expect(m.crushed).toBeGreaterThan(0);
  });

  it('a rising one-way box catches a body standing in its path', () => {
    const t = flat();
    const box = new SolidBox(80, 180, 60, 8, true);
    const e = env(box);
    const m = mover(100, FLOOR);
    settle(m, t, e);
    for (let i = 0; i < 30; i++) {
      moveSolid(box, 0, -1, [m], t, e);
      moveBody(m, t, e);
    }
    expect(m.y).toBeCloseTo(box.y, 9);
    expect(m.body.supportSolid).toBe(box);
  });

  it('ignores its own box', () => {
    const t = flat();
    const m = mover(100, FLOOR);
    const box = new SolidBox(80, 140, 40, 30, false, m);
    settle(m, t, env(box));
    walk(m, t, 1, 10, env(box));
    expect(m.x).toBe(110);
    expect(m.y).toBe(FLOOR);
  });
});

describe('physics: helpers', () => {
  it('displace stops at walls and floors', () => {
    const t = flat((d) => d.solid(200, 100, 20, 70));
    const m = mover(150, 150);
    m.body.onGround = false;
    expect(displace(m, 100, 0, t)).toBe(false);
    expect(m.x + 7).toBeCloseTo(200, 6);
    expect(displace(m, 0, 50, t)).toBe(false);
    expect(m.y).toBe(FLOOR);
  });

  it('sweep finds the first terrain or dynamic hit', () => {
    const t = flat((d) => d.solid(300, 100, 20, 20));
    const hit = sweep(t, 100, 110, 400, 110);
    expect(hit?.kind).toBe('solid');
    expect(hit?.x).toBeCloseTo(300, 9);
    expect(hit?.nx).toBe(-1);
    const box = new SolidBox(200, 100, 10, 20);
    const hit2 = sweep(t, 100, 110, 400, 110, false, { solids: [box] });
    expect(hit2?.kind).toBe('dynamic');
    expect(hit2?.x).toBeCloseTo(200, 9);
    const down = sweep(t, 50, 100, 60, 200);
    expect(down?.kind).toBe('ground');
    expect(down?.y).toBeCloseTo(FLOOR, 9);
    expect(sweep(t, 0, 50, 100, 50)).toBeNull();
  });

  it('settle places a body on the floor below', () => {
    const t = flat((d) => d.platform(0, 120, 300));
    const m = mover(100, 50);
    expect(settle(m, t)).toBe(true);
    expect(m.y).toBe(120);
    const n = mover(100, 130);
    expect(settle(n, t)).toBe(true);
    expect(n.y).toBe(FLOOR);
    expect(new Body({ w: 10, h: 10 }).gravity).toBeGreaterThan(0);
  });
});

describe('physics: regressions found by the fuzz test', () => {
  it('cannot walk up a slope under a ceiling that is too low', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 200).flat(200).slope(100, -30).flat(300);
    def.solid(220, 140, 200, 10); // bottom at 150
    const t = new Terrain(def.build());
    const m = mover(150, 200);
    settle(m, t);
    for (let i = 0; i < 200; i++) {
      m.vx = 1.45;
      moveBody(m, t);
      expect(m.y - m.body.h).toBeGreaterThanOrEqual(150 - 1e-6); // head never inside the slab
    }
    expect(m.body.contact.hitWall).toBe(true);
  });

  it('a low block under a low ceiling is a wall, not a step', () => {
    const t = flat((d) => d.solid(200, 167, 30, 3).solid(150, 100, 150, 39)); // ceiling bottom 139: 1 px headroom
    const m = mover(150, FLOOR);
    settle(m, t);
    walk(m, t, 1.45, 60);
    expect(m.x + 7).toBeCloseTo(200, 6);
    expect(m.y).toBe(FLOOR);
  });

  it('a body wider than a gap rolls over it', () => {
    const def = terrain(2000, 300);
    def.ground().at(0, 200).flat(300).gap(24).flat(500);
    const t = new Terrain(def.build());
    const wide = mover(250, 200, { w: 40, h: 24 });
    settle(wide, t);
    for (let i = 0; i < 80; i++) {
      wide.vx = 2;
      moveBody(wide, t);
      expect(wide.body.onGround).toBe(true);
      expect(wide.y).toBe(200);
    }
    expect(wide.x).toBeGreaterThan(400);
    const narrow = mover(250, 200);
    settle(narrow, t);
    walk(narrow, t, 1.45, 80);
    expect(narrow.y).toBeGreaterThan(200); // the soldier falls in
  });

  it('a rising one-way box does not lift a body into a ceiling', () => {
    const t = flat((d) => d.solid(80, 120, 60, 20)); // bottom 140: 30 px above the floor
    const box = new SolidBox(80, 175, 60, 8, true);
    const m = mover(100, FLOOR);
    settle(m, t, { solids: [box] });
    for (let i = 0; i < 20; i++) {
      moveSolid(box, 0, -1, [m], t, { solids: [box] });
      moveBody(m, t, { solids: [box] });
      expect(m.y - m.body.h).toBeGreaterThanOrEqual(140 - 1e-6);
    }
    expect(m.y).toBe(FLOOR); // the platform passed through from below
  });

  it('a descending platform sets its rider down on the floor', () => {
    const t = flat();
    const box = new SolidBox(80, 150, 60, 8, true);
    const e = { solids: [box] };
    const m = mover(100, 150);
    settle(m, t, e);
    for (let i = 0; i < 40; i++) {
      moveSolid(box, 0, 1, [m], t, e);
      moveBody(m, t, e);
      expect(m.y).toBeLessThanOrEqual(FLOOR);
    }
    expect(m.y).toBe(FLOOR);
    expect(m.body.support).toBe(SUPPORT_GROUND);
  });
});

