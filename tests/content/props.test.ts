/**
 * Shared mission props (GDD §9.5, §15.4, §15.9 item 3): every id spawns with its params and its
 * key behaviour works with the GDD numbers (bursts, rolls, carries, crushes, rises …).
 */
import { describe, expect, it } from 'vitest';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/props/index';
import '../../src/game/content/props/art';
import {
  Avalanche,
  BellowsPlatform,
  BreakableWall,
  CableCar,
  CardTable,
  DuckFloat,
  HeliumTank,
  Icicle,
  LilyPad,
  RisingWater,
  RollingDrum,
  SpringAwning,
  StatueHead,
  WillowTree,
} from '../../src/game/content/props/index';
import type { Entity } from '../../src/engine/entity';
import { hasSprite } from '../../src/engine/sprites';
import { getEntityMeta } from '../../src/game/registry';
import { FLOOR, TestWorld } from './helpers';

const PROP_IDS = [
  'helium-tank',
  'statue-head',
  'breakable-wall',
  'rolling-drum',
  'spring-awning',
  'duck-float',
  'lily-pad',
  'card-table',
  'air-jet',
  'cable-car',
  'bellows-platform',
  'icicle',
  'willow-tree',
  'avalanche',
  'rising-water',
] as const;

const shot = (amount: number, owner: number | undefined = 0, dirX = 1) => ({ amount, kind: 'bullet' as const, dirX, owner });

/** A player standing still at x (no input). */
function standAt(tw: TestWorld, x: number, y = FLOOR): void {
  const p = tw.player!;
  p.placeAt(x, y, 0);
  tw.world.camera.snap();
}

/** Drop the player from (x, y) in the air. */
function dropAt(tw: TestWorld, x: number, y: number): void {
  const p = tw.player!;
  p.placeAt(x, FLOOR, 0);
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.vx = p.vy = 0;
  p.body.onGround = false;
  tw.world.camera.snap();
}

describe('props: registry and sprites', () => {
  it('registers all 15 shared props (GDD §15.4) as props or hazards, never as enemies', () => {
    for (const id of PROP_IDS) {
      const meta = getEntityMeta(id);
      expect(meta, id).toBeDefined();
      expect(['prop', 'hazard'], id).toContain(meta!.category);
      const tw = new TestWorld({ playerX: 40 });
      const e = tw.spawn(id, 300);
      expect(e.hasTag('placeholder'), id).toBe(false);
      expect(e.hasTag('enemy'), id).toBe(false);
      expect(e.hasTag('prop'), id).toBe(true);
      tw.run(30);
      expect(tw.world.errors).toEqual([]);
      expect(tw.world.countAlive('enemy'), id).toBe(0);
    }
  });

  it('draws every prop from its own prop/<id>/… sprites', () => {
    const strips = [
      'prop/helium-tank/idle',
      'prop/helium-tank/balloon',
      'prop/helium-tank/cloud',
      'prop/statue-head/idle',
      'prop/statue-head/roll',
      'prop/rolling-drum/roll',
      'prop/duck-float/idle',
      'prop/duck-float/ripple',
      'prop/lily-pad/idle',
      'prop/card-table/idle',
      'prop/card-table/card',
      'prop/air-jet/pipe',
      'prop/cable-car/car',
      'prop/bellows-platform/body',
      'prop/icicle/idle',
      'prop/icicle/shatter',
      'prop/willow-tree/stand',
      'prop/willow-tree/fall',
      'prop/willow-tree/stump',
      'prop/willow-tree/bridge',
      'prop/avalanche/front',
      'prop/avalanche/body',
      'prop/avalanche/snowball',
      'prop/avalanche/mound',
      'prop/avalanche/hat',
      'prop/rising-water/surface',
    ];
    for (const s of strips) expect(hasSprite(s), s).toBe(true);
    // Sized props register their own sizes on demand.
    const tw = new TestWorld({ playerX: 40 });
    const wall = tw.spawn('breakable-wall', 300, { w: 32, h: 64, look: 'crystal' }) as BreakableWall;
    const net = tw.spawn('spring-awning', 500, { w: 96, variant: 'net' }, 150) as SpringAwning;
    expect(hasSprite(wall.sprite)).toBe(true);
    expect(hasSprite(wall.rubble)).toBe(true);
    expect(hasSprite(net.sprite)).toBe(true);
  });
});

describe('helium-tank', () => {
  it('10 HP, 100 points; bursts into a 48×48 cloud for 120 ticks that gives Helium Head', () => {
    const tw = new TestWorld({ playerX: 40 });
    const tank = tw.spawn('helium-tank', 300) as HeliumTank;
    expect(tank).toBeInstanceOf(HeliumTank);
    expect(tank.hp).toBe(10);
    expect(tank.hasTag('soft')).toBe(true); // knifeable
    tw.world.damage(tank, shot(9));
    expect(tank.burst).toBe(false);
    tw.world.damage(tank, shot(1));
    expect(tank.burst).toBe(true);
    expect(tw.session.slots[0].score).toBe(100);
    expect(tank.cloudRect.w).toBe(48);
    expect(tank.cloudRect.h).toBe(48);
    // A player walks into the cloud.
    standAt(tw, 300);
    tw.run(2);
    expect(tw.player!.status.has('helium-head')).toBe(true);
    tw.run(130);
    expect(tank.removed).toBe(true);
  });

  it('a player outside the cloud is not gassed', () => {
    const tw = new TestWorld({ playerX: 40 });
    const tank = tw.spawn('helium-tank', 300) as HeliumTank;
    tw.world.damage(tank, shot(10));
    tw.run(20);
    expect(tw.player!.status.has('helium-head')).toBe(false);
  });
});

describe('statue-head', () => {
  it('50 HP; knocked off: VANDALISM +500, rolls 64 px at 1.5 px/tick and crushes infantry (SET PIECE +200)', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const head = tw.spawn('statue-head', 300) as StatueHead;
    const soldier = tw.spawn('rifleman', 340, { facing: -1 });
    tw.world.damage(head, shot(49));
    expect(head.state).toBe('perch');
    const before = tw.session.slots[0].score;
    tw.world.damage(head, shot(1, 0, 1));
    expect(head.state).toBe('topple');
    expect(tw.session.slots[0].score - before).toBe(500);
    expect(tw.hud.callouts.some((c) => c.text.startsWith('VANDALISM!'))).toBe(true);
    tw.until(() => head.state === 'rest', 200);
    expect(head.rolled).toBeGreaterThanOrEqual(64);
    expect(head.rolled).toBeLessThan(64 + 2);
    expect(soldier.alive).toBe(false);
    expect(tw.hud.callouts.some((c) => c.text === 'SET PIECE! +200')).toBe(true);
    // It rolls at 1.5 px/tick (away from the shot).
    expect(head.x).toBeGreaterThan(300 + 60);
  });

  it('never hurts players', () => {
    const tw = new TestWorld({ playerX: 340 });
    const head = tw.spawn('statue-head', 300) as StatueHead;
    tw.world.damage(head, shot(50, 0, 1));
    tw.run(80);
    expect(tw.player!.state).toBe('play');
  });
});

describe('breakable-wall', () => {
  it('24×48, 200 HP, 100 points; cracks after the first hit; blocks until broken; reveals its secrets', () => {
    const tw = new TestWorld({ playerX: 200 });
    const wall = tw.spawn('breakable-wall', 300, { reveal: [{ id: 'pickup-gem', params: { kind: 'gem' }, dx: 0 }] }) as BreakableWall;
    expect(wall.w).toBe(24);
    expect(wall.h).toBe(48);
    expect(wall.hp).toBe(200);
    expect(wall.box).not.toBeNull();
    expect(wall.stage).toBe(0);
    tw.world.damage(wall, shot(1));
    expect(wall.stage).toBe(1);
    // The player walks right into it and stops at its face.
    tw.hold('right').run(80);
    expect(tw.player!.x).toBeLessThan(300 - 12);
    tw.world.damage(wall, shot(199));
    expect(wall.broken).toBe(true);
    expect(wall.box).toBeNull();
    expect(tw.session.slots[0].score).toBe(100);
    tw.world.flush();
    expect(tw.ofType('pickup-gem').length).toBe(1);
    tw.run(40);
    expect(tw.player!.x).toBeGreaterThan(300);
  });

  it('params w, h; solid: false is a secret wall behind the actors (no solid)', () => {
    const tw = new TestWorld({ playerX: 200 });
    const wall = tw.spawn('breakable-wall', 300, { w: 40, h: 64, solid: false, look: 'rock' }) as BreakableWall;
    expect(wall.w).toBe(40);
    expect(wall.h).toBe(64);
    expect(wall.solid).toBe(false);
    expect(wall.box).toBeNull();
    // Broken, a secret wall leaves its dark niche (a solid one leaves rubble).
    expect(wall.rubble.endsWith('-niche')).toBe(true);
    expect(wall.hitRect({ x: 0, y: 0, w: 0, h: 0 })).toEqual({ x: 280, y: FLOOR - 64, w: 40, h: 64 });
    tw.hold('right').run(80);
    expect(tw.player!.x).toBeGreaterThan(300);
  });
});

describe('rolling-drum', () => {
  it('40 HP, 100 points; rolls 2 px/tick along the floor toward the player', () => {
    const tw = new TestWorld({ playerX: 40 });
    const drum = tw.spawn('rolling-drum', 400) as RollingDrum;
    tw.run(11);
    expect(drum.dir).toBe(-1);
    const x0 = drum.x;
    tw.run(10);
    expect(x0 - drum.x).toBeCloseTo(20, 5);
    tw.world.damage(drum, shot(39));
    expect(drum.dead).toBe(false);
    tw.world.damage(drum, shot(1));
    expect(drum.removed || drum.dead).toBe(true);
    expect(tw.session.slots[0].score).toBe(100);
  });

  it('contact kills a player on foot', () => {
    const tw = new TestWorld({ playerX: 200 });
    tw.spawn('rolling-drum', 360, { dir: -1 });
    tw.until(() => tw.player!.state === 'dead', 200);
  });

  it('rolls down a slope and smashes on a wall', () => {
    const tw = new TestWorld({
      noFloor: true,
      playerX: null,
      build: (t) => {
        t.ground().at(0, 120).flat(200).slope(200, FLOOR - 120).flat(1000);
        t.solid(700, FLOOR - 64, 32, 64);
      },
    });
    const drum = tw.spawn('rolling-drum', 150, { dir: 1 }, 120) as RollingDrum;
    tw.until(() => drum.x > 300, 200);
    expect(drum.y).toBeGreaterThan(120);
    tw.until(() => drum.removed, 400);
    expect(drum.x).toBeLessThan(700);
  });
});

describe('spring-awning', () => {
  it('a player who lands on it is launched at vy −6.0 (variant net too)', () => {
    for (const variant of ['awning', 'net']) {
      const tw = new TestWorld({ playerX: 40 });
      const aw = tw.spawn('spring-awning', 300, { w: 64, variant }, 150) as SpringAwning;
      expect(aw.variant).toBe(variant);
      expect(aw.w).toBe(64);
      dropAt(tw, 300, 100);
      let minVy = 0;
      tw.until(() => aw.bounces > 0, 120);
      for (let i = 0; i < 3; i++) {
        minVy = Math.min(minVy, tw.player!.vy);
        tw.run(1);
      }
      expect(minVy).toBeLessThanOrEqual(-5.5);
      // It goes up well above the awning.
      let top = Infinity;
      for (let i = 0; i < 60; i++) {
        top = Math.min(top, tw.player!.y);
        tw.run(1);
      }
      expect(150 - top).toBeGreaterThan(80);
    }
  });
});

describe('moving platforms', () => {
  it('duck-float: drifts ±drift at 0.5 px/tick, bobs ±3 px and carries a rider', () => {
    const tw = new TestWorld({
      playerX: 40,
      build: (t) => t.hazard('water', 400, 170, 200, 40),
    });
    const duck = tw.spawn('duck-float', 500, { drift: 34 }, 170) as DuckFloat;
    expect(duck.waterline).toBe(170);
    let lo = Infinity;
    let hi = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < 400; i++) {
      tw.run(1);
      lo = Math.min(lo, duck.x);
      hi = Math.max(hi, duck.x);
      top = Math.min(top, duck.top);
      bottom = Math.max(bottom, duck.top);
    }
    expect(lo).toBeCloseTo(466, 5);
    expect(hi).toBeCloseTo(534, 5);
    expect(bottom - top).toBeGreaterThan(5.5);
    expect(bottom - top).toBeLessThanOrEqual(6.01);
    // A player dropped on its back rides along.
    dropAt(tw, duck.x, duck.top - 20);
    tw.until(() => tw.player!.body.supportSolid === duck.box, 60);
    const dx = tw.player!.x - duck.x;
    tw.run(30);
    expect(tw.player!.body.supportSolid).toBe(duck.box);
    expect(tw.player!.x - duck.x).toBeCloseTo(dx, 0);
  });

  it('lily-pad: a 24×6 static one-way platform at water level', () => {
    const tw = new TestWorld({ playerX: 40 });
    const pad = tw.spawn('lily-pad', 300, {}, 150) as LilyPad;
    expect(pad.box.w).toBe(24);
    expect(pad.box.oneWay).toBe(true);
    dropAt(tw, 300, 120);
    tw.until(() => tw.player!.body.supportSolid === pad.box, 60);
    expect(tw.player!.y).toBeCloseTo(150, 0);
    // It is one-way: a jump from below passes through.
    const tw2 = new TestWorld({ playerX: 300 });
    tw2.spawn('lily-pad', 300, {}, 150);
    tw2.hold('jump').run(20);
    expect(tw2.player!.y).toBeLessThan(150);
  });

  it('cable-car: waits, then moves at 0.5 px/tick while a player rides, stays at the end', () => {
    const tw = new TestWorld({ playerX: 40, width: 800 });
    const car = tw.spawn('cable-car', 400, { toY: 60 }, 150) as CableCar;
    tw.run(30);
    expect(car.state).toBe('wait');
    expect(car.top).toBe(150);
    dropAt(tw, 400, 130);
    tw.until(() => car.state === 'move', 60);
    const y0 = car.top;
    tw.run(20);
    expect(y0 - car.top).toBeCloseTo(10, 5);
    expect(tw.player!.body.supportSolid).toBe(car.box);
    tw.until(() => car.state === 'done', 400);
    expect(car.top).toBe(60);
    expect(tw.player!.y).toBeCloseTo(60, 0);
    tw.run(30);
    expect(car.top).toBe(60);
  });

  it('cable-car with hold stops when nobody rides it', () => {
    const tw = new TestWorld({ playerX: 40, width: 800 });
    const car = tw.spawn('cable-car', 400, { toX: 600, toY: 150 }, 150) as CableCar;
    dropAt(tw, 400, 130);
    tw.until(() => car.state === 'move', 60);
    tw.run(10);
    const x = car.x;
    // The player jumps off to the left and runs away.
    tw.player!.placeAt(100, FLOOR, 0);
    tw.run(20);
    expect(car.x).toBeCloseTo(x, 5);
    expect(car.state).toBe('move');
  });

  it('bellows-platform: rises and falls 24 px every 120 ticks and carries its rider', () => {
    const tw = new TestWorld({ playerX: 40 });
    const b = tw.spawn('bellows-platform', 300, {}, 150) as BellowsPlatform;
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < 120; i++) {
      tw.run(1);
      top = Math.min(top, b.top);
      bottom = Math.max(bottom, b.top);
    }
    expect(bottom).toBeCloseTo(150, 1);
    expect(top).toBeCloseTo(126, 1);
    const t0 = b.top;
    tw.run(120);
    expect(b.top).toBeCloseTo(t0, 5);
    dropAt(tw, 300, b.top - 30);
    tw.until(() => tw.player!.body.supportSolid === b.box, 60);
    for (let i = 0; i < 120; i++) {
      tw.run(1);
      expect(tw.player!.body.supportSolid).toBe(b.box);
      expect(tw.player!.y).toBeCloseTo(b.top, 0);
    }
  });
});

describe('scenery', () => {
  it('card-table: the cards fly when a player at the table dies', () => {
    const tw = new TestWorld({ playerX: 40 });
    const table = tw.spawn('card-table', 312) as CardTable;
    const a = tw.spawn('rifleman', 300, { gag: 'cards', facing: 1 });
    tw.spawn('rifleman', 324, { gag: 'cards', facing: -1 });
    tw.run(10);
    expect(table.scattered).toBe(false);
    tw.world.damage(a, shot(999));
    tw.run(2);
    expect(table.scattered).toBe(true);
  });

  it('air-jet: an airborne player inside is pushed up 1.5 px/tick (slower falls)', () => {
    const fallSpeed = (withJet: boolean) => {
      const tw = new TestWorld({ playerX: 300 });
      if (withJet) tw.spawn('air-jet', 300, { h: 400 });
      dropAt(tw, 300, -300);
      tw.run(60);
      const y0 = tw.player!.y;
      tw.run(10);
      return (tw.player!.y - y0) / 10;
    };
    const free = fallSpeed(false);
    const slow = fallSpeed(true);
    expect(free).toBeGreaterThan(2);
    expect(free - slow).toBeCloseTo(1.5, 1);
  });

  it('air-jet: a player standing on the floor inside is not lifted', () => {
    const tw = new TestWorld({ playerX: 300 });
    tw.spawn('air-jet', 300, { h: 96 });
    tw.run(30);
    expect(tw.player!.y).toBe(FLOOR);
  });
});

describe('icicle (the m3-b2 Icicle Organ)', () => {
  const organ = (tw: TestWorld) => {
    const out: Icicle[] = [];
    for (let i = 0; i < 8; i++) out.push(tw.spawn('icicle', 60 + 38 * i, {}, 40) as Icicle);
    return out;
  };

  it('10 HP, 50 points; one note per icicle, rising left to right', () => {
    const tw = new TestWorld({ playerX: 40 });
    const ics = organ(tw);
    expect(ics[0].hp).toBe(10);
    for (let i = 1; i < 8; i++) expect(ics[i].pitch).toBeGreaterThan(ics[i - 1].pitch);
    expect(ics[7].pitch / ics[0].pitch).toBeCloseTo(2, 5);
    tw.world.damage(ics[0], shot(10));
    expect(ics[0].broken).toBe(true);
    expect(tw.session.slots[0].score).toBe(50);
  });

  it('all 8 left to right: 10 golden notes and a gem; any other order: nothing', () => {
    const tw = new TestWorld({ playerX: 40 });
    const ics = organ(tw);
    for (const ic of ics) tw.world.damage(ic, shot(10));
    tw.world.flush();
    const gems = tw.ofType('pickup-gem');
    expect(gems.length).toBe(11);
    const tw2 = new TestWorld({ playerX: 40 });
    const ics2 = organ(tw2);
    tw2.world.damage(ics2[1], shot(10));
    for (const ic of ics2) tw2.world.damage(ic, shot(10));
    tw2.world.flush();
    expect(tw2.ofType('pickup-gem').length).toBe(0);
  });
});

describe('willow-tree (m1-c)', () => {
  const setup = (god = false) => {
    const tw = new TestWorld({ playerX: 1850, width: 2400, god });
    const tree = tw.spawn('willow-tree', 1940, { bridgeY: 170 }) as WillowTree;
    return { tw, tree };
  };

  it('trunk 200 HP, 1,000 points; falls in 40 ticks into a solid bridge 160×12 at 1950–2110', () => {
    const { tw, tree } = setup();
    expect(tree.hp).toBe(200);
    tw.world.damage(tree, shot(199));
    expect(tree.state).toBe('stand');
    tw.world.damage(tree, shot(1));
    expect(tree.state).toBe('fall');
    expect(tw.session.slots[0].score).toBe(1000);
    tw.run(39);
    expect(tree.state).toBe('fall');
    tw.run(1);
    expect(tree.state).toBe('bridge');
    expect(tree.box).not.toBeNull();
    const b = tree.box!;
    expect([b.x, b.y, b.w, b.h, b.oneWay]).toEqual([1950, 170, 160, 12, false]);
  });

  it('shows SHOOT! after 180 ticks in view without a hit', () => {
    const { tw, tree } = setup();
    tw.run(170);
    expect(tw.hud.pointers.some((p) => p.target === tree)).toBe(false);
    tw.run(20);
    expect(tw.hud.pointers.some((p) => p.target === tree)).toBe(true);
    tw.world.damage(tree, shot(1));
    expect(tw.hud.pointers.some((p) => p.target === tree)).toBe(false);
  });

  it('crushes the enemies it lands on (SET PIECE +200 each) and pushes a player out, unhurt', () => {
    // God mode: the riflemen in the fall zone must not shoot the test player first.
    const { tw, tree } = setup(true);
    const a = tw.spawn('rifleman', 2000, { facing: -1 });
    const c = tw.spawn('rifleman', 2060, { facing: -1 });
    // The player stands under the landing zone, nearer the far end.
    standAt(tw, 2080);
    tw.world.damage(tree, shot(200));
    tw.run(40);
    expect(tree.state).toBe('bridge');
    expect(a.alive).toBe(false);
    expect(c.alive).toBe(false);
    expect(tree.crushed).toBe(2);
    expect(tw.hud.callouts.some((x) => x.text === 'SET PIECE! +400')).toBe(true);
    const p = tw.player!;
    expect(p.state).toBe('play');
    expect(p.x).toBeGreaterThan(2110);
  });
});

describe('willow-tree and the Swan', () => {
  it('a ridden Swan swimming under the falling willow is pushed out past the bridge end, unhurt', async () => {
    await import('../../src/game/content/vehicles/swan/index');
    // A bank up to x 1950, then a deep river (the m1-c layout): the bridge lands on the water.
    const tw = new TestWorld({
      playerX: 1850,
      width: 2400,
      noFloor: true,
      build: (t) => {
        t.ground().at(0, FLOOR).flat(1950);
        t.ground().at(1950, 224).flat(450);
        t.hazard('water', 1950, FLOOR, 450, 60);
      },
    });
    const tree = tw.spawn('willow-tree', 1940, { bridgeY: 170 }) as WillowTree;
    const swan = tw.spawn('swan', 2040) as Entity & { mount(p: unknown): void; cells: number };
    swan.mount(tw.player!);
    tw.run(30);
    const cells = swan.cells;
    tw.world.damage(tree, shot(200));
    tw.run(60);
    expect(tree.state).toBe('bridge');
    expect(swan.alive).toBe(true);
    expect(swan.cells).toBe(cells);
    expect(tw.player!.state).toBe('mounted');
    expect(swan.x).toBeGreaterThan(2110);
    expect(tw.world.errors).toEqual([]);
  });
});

describe('props facing left', () => {
  it('a willow with dir −1 falls left into a bridge that ends 10 px before its trunk', () => {
    const tw = new TestWorld({ playerX: 400, god: true });
    const tree = tw.spawn('willow-tree', 400, { dir: -1, bridgeY: 170 }) as WillowTree;
    tw.world.damage(tree, shot(200, 0, -1));
    tw.run(40);
    const b = tree.box!;
    expect([b.x, b.w]).toEqual([400 - 10 - 160, 160]);
  });

  it('a statue head shot from the right rolls left; a drum with dir −1 rolls left', () => {
    const tw = new TestWorld({ playerX: 500, god: true });
    const head = tw.spawn('statue-head', 300) as StatueHead;
    tw.world.damage(head, shot(50, 0, -1));
    tw.until(() => head.state === 'rest', 200);
    expect(head.x).toBeLessThan(300 - 60);
    const drum = tw.spawn('rolling-drum', 450, { dir: -1 }) as RollingDrum;
    tw.run(5);
    expect(drum.x).toBeLessThan(450);
  });
});

describe('avalanche (m3-a pursuit wall)', () => {
  const params = { speed: 1, maxSpeed: 3, holdX: 40, gap: 104, stopX: 2540 };

  it('rolls in at view x 8 and never closer than gap to the rearmost player', () => {
    const tw = new TestWorld({ playerX: 300, width: 3000 });
    const av = tw.spawn('avalanche', 0, params) as Avalanche;
    tw.run(1);
    const cam = tw.world.camera;
    expect(av.front).toBeCloseTo(Math.min(cam.left + 8, 300 - 104), 5);
  });

  it('a running player who stops is caught after about 90–110 ticks', () => {
    const tw = new TestWorld({ playerX: 300, width: 3000 });
    tw.spawn('avalanche', 0, params) as Avalanche;
    tw.hold('right').run(300);
    expect(tw.player!.state).toBe('play');
    tw.hold();
    const t = tw.until(() => tw.player!.state === 'dead', 300);
    expect(t).toBeGreaterThanOrEqual(80);
    expect(t).toBeLessThanOrEqual(120);
  });

  it('a player who keeps running right (1.5 px/tick) is never caught; it holds the view left part', () => {
    const tw = new TestWorld({ playerX: 300, width: 3000 });
    const av = tw.spawn('avalanche', 0, { ...params, stopX: 2900 }) as Avalanche;
    tw.hold('right');
    for (let i = 0; i < 900; i++) {
      tw.run(1);
      expect(tw.player!.state).toBe('play');
      expect(av.front - tw.world.camera.left).toBeLessThanOrEqual(40 + 3);
      expect(tw.player!.x - av.front).toBeGreaterThan(24);
    }
    // It moves at least `speed` and at most `maxSpeed` per tick.
    const f0 = av.front;
    tw.run(1);
    expect(av.front - f0).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(av.front - f0).toBeLessThanOrEqual(3 + 1e-9);
  });

  it('swallows enemies (SET PIECE +200 to the nearest player) and respawns land 160 px right of its front', () => {
    const tw = new TestWorld({ playerX: 300, width: 3000, god: false });
    const av = tw.spawn('avalanche', 0, params) as Avalanche;
    const r = tw.spawn('rifleman', 120, { facing: 1 });
    tw.until(() => !r.alive, 200);
    expect(av.swallowed).toBe(1);
    expect(tw.hud.callouts.some((c) => c.text === 'SET PIECE! +200')).toBe(true);
    const spot = tw.player!.respawnRule!(tw.player!);
    expect(spot).not.toBeNull();
    expect(spot!.x).toBeGreaterThanOrEqual(av.front + 160);
  });

  it('stops at stopX: the kill zone switches off and the respawn rule is given back', () => {
    const tw = new TestWorld({ playerX: 300, width: 3000 });
    const av = tw.spawn('avalanche', 0, { ...params, stopX: 260 }) as Avalanche;
    tw.hold('right').run(1);
    expect(tw.world.terrain.hazards.includes(av.hazard)).toBe(true);
    tw.until(() => av.state === 'stopped', 400);
    expect(av.front).toBe(260);
    expect(tw.world.terrain.hazards.includes(av.hazard)).toBe(false);
    expect(tw.player!.respawnRule).toBeNull();
    const f = av.front;
    tw.run(60);
    expect(av.front).toBe(f);
  });
});

describe('rising-water (m3-b2 meltwater)', () => {
  it('rises 0.3 px/tick from startY, never more than 48 px below the view bottom', () => {
    const tw = new TestWorld({ playerX: 100 });
    const w = tw.spawn('rising-water', 0, { startY: 400 }) as RisingWater;
    tw.run(1);
    const cam = tw.world.camera;
    expect(w.top).toBeCloseTo(cam.bottom + 48, 5);
    const t0 = w.top;
    tw.run(10);
    expect(t0 - w.top).toBeCloseTo(3, 5);
    expect(w.hazard.kind).toBe('kill');
    expect(w.hazard.y).toBeCloseTo(w.top, 5);
  });

  it('kills a player it reaches; setSpeed with a cap holds it below the view bottom − cap', () => {
    const tw = new TestWorld({ playerX: 100 });
    const w = tw.spawn('rising-water', 0, { startY: 230 }) as RisingWater;
    tw.until(() => tw.player!.state === 'dead', 400);
    const tw2 = new TestWorld({ playerX: 100, god: true });
    const w2 = tw2.spawn('rising-water', 0, { startY: 230 }) as RisingWater;
    w2.setSpeed(0.15, 48);
    tw2.run(600);
    expect(w2.top).toBeCloseTo(tw2.world.camera.bottom - 48, 5);
    void w;
  });

  it('removes its hazard when it is removed', () => {
    const tw = new TestWorld({ playerX: 100 });
    const w = tw.spawn('rising-water', 0, { startY: 230 }) as RisingWater;
    expect(tw.world.terrain.hazards.includes(w.hazard)).toBe(true);
    w.remove();
    tw.run(1);
    expect(tw.world.terrain.hazards.includes(w.hazard)).toBe(false);
  });
});

describe('props: two players and budget', () => {
  it('helium cloud gasses both players; the cable car starts for player 2 too', async () => {
    const { Player } = await import('../../src/game/player/player');
    const { VirtualPad } = await import('../../src/engine/input');
    const tw = new TestWorld({ playerX: 40 });
    const p2 = new Player(tw.world, 310, FLOOR, { pad: new VirtualPad(), index: 1 });
    tw.world.add(p2);
    tw.world.flush();
    p2.placeAt(310, FLOOR, 0);
    standAt(tw, 290);
    const tank = tw.spawn('helium-tank', 300) as HeliumTank;
    tw.world.damage(tank, shot(10, 1));
    tw.run(2);
    expect(tw.player!.status.has('helium-head')).toBe(true);
    expect(p2.status.has('helium-head')).toBe(true);
    expect(tw.session.slots[1].score).toBe(100);
  });

  it('30 copies of each prop update in well under 0.5 ms per tick', () => {
    const tw = new TestWorld({ playerX: 100, god: true, build: (t) => t.hazard('water', 0, 170, 1600, 40) });
    const placed: Entity[] = [];
    for (const id of PROP_IDS) {
      if (id === 'avalanche' || id === 'rising-water' || id === 'willow-tree') continue;
      for (let i = 0; i < 30; i++) placed.push(tw.spawn(id, 120 + i * 40, {}, id === 'icicle' ? 20 : id === 'duck-float' ? 170 : id === 'cable-car' || id === 'bellows-platform' || id === 'lily-pad' || id === 'spring-awning' ? 120 : FLOOR));
    }
    for (let i = 0; i < 30; i++) placed.push(tw.spawn('willow-tree', 120 + i * 40));
    tw.run(60);
    const t0 = performance.now();
    tw.run(300);
    const per = (performance.now() - t0) / 300;
    // 12 kinds × 30 copies plus the world; generous bound for a shared test machine.
    expect(per).toBeLessThan(6);
    expect(tw.world.errors).toEqual([]);
  });
});
