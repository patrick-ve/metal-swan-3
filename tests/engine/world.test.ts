import { describe, expect, it } from 'vitest';
import { type Damage, Entity, type ShotLike, type Team } from '../../src/engine/entity';
import { Body, SolidBox, moveBody } from '../../src/engine/physics';
import type { Renderer } from '../../src/engine/render';
import { Terrain, terrain } from '../../src/engine/terrain';
import { PlaceholderEntity, World } from '../../src/engine/world';
import { RecordingRenderer } from './helpers';

const FLOOR = 170;

function flatWorld(seed = 1, extra?: (t: ReturnType<typeof terrain>) => void): World {
  const t = terrain(4000, 216);
  t.ground().at(0, FLOOR).flat(4000);
  extra?.(t);
  return new World({ terrain: new Terrain(t.build()), seed });
}

/** Target dummy: shootable, team configurable, logs hits. */
class Dummy extends Entity {
  hits: Array<{ d: Damage; part: number }> = [];
  constructor(world: World, x: number, y: number, team: Team = 'enemy', hp = 3) {
    super(world, x, y);
    this.team = team;
    this.hp = this.maxHp = hp;
    this.hitbox = { x: -7, y: -30, w: 14, h: 30 };
    this.addTag('shootable', team);
  }
  override onHit(d: Damage, part = 0): boolean {
    this.hits.push({ d, part });
    return super.onHit(d, part);
  }
}

/** Straight-flying shot. */
class Bullet extends Entity implements ShotLike {
  damage: Damage;
  pierce?: number;
  impacts: Array<{ target: Entity | null; x: number; y: number }> = [];
  constructor(world: World, x: number, y: number, vx: number, team: Team, pierce?: number) {
    super(world, x, y);
    this.vx = vx;
    this.team = team;
    this.pierce = pierce;
    this.hitbox = { x: -2, y: -1, w: 4, h: 2 };
    this.damage = { amount: 1, kind: 'bullet', dirX: Math.sign(vx) };
    this.addTag('shot');
    this.despawnMargin = 32;
  }
  override update(): void {
    this.x += this.vx;
  }
  onImpact(target: Entity | null, x: number, y: number): void {
    this.impacts.push({ target, x, y });
  }
}

class Walker extends Entity {
  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.body = new Body({ w: 14, h: 30 });
    this.despawnMargin = Infinity;
  }
  override update(): void {
    moveBody(this, this.world.terrain, this.world);
  }
}

describe('World: entity lifecycle', () => {
  it('spawns through the factory and updates in insertion order', () => {
    const order: string[] = [];
    class Logger extends Entity {
      override update(): void {
        order.push(this.type);
      }
    }
    const w = flatWorld();
    w.factory = (id, world, x, y) => (id === 'a' || id === 'b' ? new Logger(world, x, y) : null);
    w.spawn('b', 10, 10);
    w.spawn('a', 20, 10);
    w.update();
    expect(order).toEqual(['b', 'a']);
    expect(w.entities.map((e) => e.type)).toEqual(['b', 'a']);
  });

  it('entities spawned during the entity pass start next tick; removal is deferred', () => {
    const w = flatWorld();
    const log: string[] = [];
    class Child extends Entity {
      override update(): void {
        log.push(`child@${this.world.tick}`);
      }
    }
    class Parent extends Entity {
      override update(): void {
        log.push(`parent@${this.world.tick}`);
        if (this.age === 0) this.world.add(new Child(this.world, 0, 0));
        if (this.age === 1) this.remove();
      }
    }
    const p = w.add(new Parent(w, 0, 0));
    w.update();
    expect(w.entities.length).toBe(2); // child joined after the pass
    w.update();
    expect(p.removed).toBe(true);
    expect(w.entities.includes(p)).toBe(false);
    w.update();
    expect(log).toEqual(['parent@0', 'parent@1', 'child@1', 'child@2']);
  });

  it('unknown ids spawn a placeholder and warn once', () => {
    const w = flatWorld();
    const warn = console.warn;
    const msgs: string[] = [];
    console.warn = (m: string) => msgs.push(m);
    try {
      const a = w.spawn('no-such-thing-xyz', 50, FLOOR);
      w.spawn('no-such-thing-xyz', 60, FLOOR);
      expect(a).toBeInstanceOf(PlaceholderEntity);
      expect(a.type).toBe('no-such-thing-xyz');
    } finally {
      console.warn = warn;
    }
    expect(msgs.filter((m) => m.includes('no-such-thing-xyz'))).toHaveLength(1);
    w.update();
    const r = new RecordingRenderer();
    w.draw(r);
    expect(r.calls.some((c) => c.op === 'rect' && c.args[4] === 0xff00ffff)).toBe(true);
    expect(w.byTag('placeholder')).toHaveLength(2);
  });

  it('isolates a throwing entity: logged once, removed, world continues', () => {
    const w = flatWorld();
    class Bad extends Entity {
      override update(): void {
        throw new Error('kaboom');
      }
    }
    let ticks = 0;
    class Good extends Entity {
      override update(): void {
        ticks++;
      }
    }
    w.add(new Bad(w, 0, 0));
    w.add(new Good(w, 0, 0));
    const err = console.error;
    let logged = 0;
    console.error = () => logged++;
    try {
      for (let i = 0; i < 5; i++) w.update();
    } finally {
      console.error = err;
    }
    expect(ticks).toBe(5);
    expect(w.entities).toHaveLength(1);
    expect(w.errors).toHaveLength(1);
    expect(w.errors[0].message).toBe('kaboom');
    expect(logged).toBe(1);
  });

  it('byTag arrays are live and stable, even before the first entity with the tag', () => {
    const w = flatWorld();
    const players = w.players;
    expect(players).toHaveLength(0);
    const p = w.add(new Dummy(w, 100, FLOOR, 'player'));
    p.addTag('player');
    w.update();
    expect(players).toEqual([p]);
    expect(w.byTag('player')).toBe(players);
  });

  it('tag index follows addTag / removeTag / removal', () => {
    const w = flatWorld();
    const e = w.add(new Dummy(w, 100, FLOOR));
    w.update();
    expect(w.byTag('enemy')).toEqual([e]);
    e.addTag('boss');
    expect(w.byTag('boss')).toEqual([e]);
    e.removeTag('boss');
    expect(w.byTag('boss')).toEqual([]);
    e.remove();
    w.update();
    expect(w.byTag('enemy')).toEqual([]);
    expect(w.countAlive('enemy')).toBe(0);
  });

  it('emits spawn / remove / hit / killed events', () => {
    const w = flatWorld();
    const seen: string[] = [];
    w.events.on('spawn', (e) => seen.push(`spawn:${e.id}`));
    w.events.on('remove', (e) => seen.push(`remove:${e.id}`));
    w.events.on('hit', (h) => seen.push(`hit:${h.target.id}:${h.absorbed}`));
    w.events.on('killed', (k) => seen.push(`killed:${k.target.id}`));
    const d = w.add(new Dummy(w, 100, FLOOR, 'enemy', 1));
    w.update();
    w.damage(d, { amount: 5, kind: 'knife', dirX: 1 });
    w.update();
    expect(seen).toEqual([`spawn:${d.id}`, `hit:${d.id}:true`, `killed:${d.id}`, `remove:${d.id}`]);
  });

  it('despawns entities that were seen and left the area; never-seen ones stay', () => {
    const w = flatWorld();
    w.camera.x = 0;
    const near = w.add(new Dummy(w, 100, FLOOR));
    const far = w.add(new Dummy(w, 2000, FLOOR));
    const pinned = w.add(new Dummy(w, 120, FLOOR));
    pinned.despawnMargin = Infinity;
    w.update();
    expect(near.seen).toBe(true);
    expect(far.seen).toBe(false);
    // Move the view far to the right: `near` is now >160 px outside.
    w.camera.scroll = 'free';
    w.camera.x = 1000;
    w.camera.follow({ x: 1192, y: FLOOR });
    w.camera.snap();
    w.update();
    expect(near.removed).toBe(true);
    expect(far.removed).toBe(false);
    expect(pinned.removed).toBe(false);
  });

  it('entities below killY get onOutOfWorld (default: removed)', () => {
    const w = flatWorld();
    const e = w.add(new Dummy(w, 100, 400));
    e.despawnMargin = Infinity;
    w.update();
    expect(e.removed).toBe(true);
  });

  it('runs the same way for the same seed', () => {
    const run = (seed: number): string => {
      const w = flatWorld(seed);
      w.scripts.run(function* () {
        for (let i = 0; i < 5; i++) {
          w.add(new Dummy(w, w.rng.int(0, 300), FLOOR, 'enemy', w.rng.int(1, 4)));
          yield w.rng.int(1, 5);
        }
      });
      for (let i = 0; i < 40; i++) w.update();
      return w.entities.map((e) => `${e.x}:${e.hp}`).join(',') + `|${w.rng.next()}`;
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});

describe('World: damage passes', () => {
  it('shots hit only hostile shootables, the nearest first, and stop', () => {
    const w = flatWorld();
    const ally = w.add(new Dummy(w, 120, FLOOR, 'player'));
    const hostage = w.add(new Dummy(w, 130, FLOOR, 'neutral'));
    const far = w.add(new Dummy(w, 200, FLOOR, 'enemy'));
    const near = w.add(new Dummy(w, 160, FLOOR, 'enemy'));
    const b = w.add(new Bullet(w, 100, 155, 12, 'player'));
    for (let i = 0; i < 10; i++) w.update();
    expect(ally.hits).toHaveLength(0);
    expect(hostage.hits).toHaveLength(0);
    expect(near.hits).toHaveLength(1);
    expect(far.hits).toHaveLength(0);
    expect(b.removed).toBe(true);
    expect(b.impacts).toHaveLength(1);
    expect(b.impacts[0].target).toBe(near);
    // Impact point: the bullet's box front touches the target's box (x = 153 - 2).
    expect(b.impacts[0].x).toBeCloseTo(151, 6);
  });

  it('fast shots never skip a thin target', () => {
    const w = flatWorld();
    const thin = w.add(new Dummy(w, 300, FLOOR, 'enemy'));
    thin.hitbox = { x: -1, y: -30, w: 2, h: 30 };
    w.add(new Bullet(w, 100, 155, 40, 'player'));
    for (let i = 0; i < 10; i++) w.update();
    expect(thin.hits).toHaveLength(1);
  });

  it('piercing shots hit each target once; invulnerable targets let shots pass', () => {
    const w = flatWorld();
    const a = w.add(new Dummy(w, 150, FLOOR, 'enemy', 10));
    const ghost = w.add(new Dummy(w, 175, FLOOR, 'enemy', 10));
    ghost.invulnTicks = 1000;
    const c = w.add(new Dummy(w, 200, FLOOR, 'enemy', 10));
    const b = w.add(new Bullet(w, 100, 155, 4, 'player', 1));
    for (let i = 0; i < 40; i++) w.update();
    expect(a.hp).toBe(9);
    expect(ghost.hp).toBe(10);
    expect(c.hp).toBe(9);
    expect(b.removed).toBe(true);
    expect(b.impacts.map((x) => x.target)).toEqual([a, c]);
  });

  it('terrain stops shots, and targets in front of a wall are still hit first', () => {
    const w = flatWorld(1, (t) => t.solid(200, 100, 20, 70));
    const front = w.add(new Dummy(w, 196, FLOOR, 'enemy'));
    const behind = w.add(new Dummy(w, 260, FLOOR, 'enemy'));
    const b1 = w.add(new Bullet(w, 150, 155, 30, 'player'));
    for (let i = 0; i < 5; i++) w.update();
    expect(front.hits).toHaveLength(1);
    expect(b1.impacts[0].target).toBe(front);
    front.remove();
    w.update();
    const b2 = w.add(new Bullet(w, 150, 155, 30, 'player'));
    for (let i = 0; i < 5; i++) w.update();
    expect(behind.hits).toHaveLength(0);
    expect(b2.impacts[0].target).toBeNull();
    expect(b2.impacts[0].x).toBeCloseTo(200, 6);
  });

  it('damageArea hits hostiles in range once each, with falloff', () => {
    const w = flatWorld();
    const close = w.add(new Dummy(w, 100, FLOOR, 'enemy', 100));
    const edge = w.add(new Dummy(w, 140, FLOOR, 'enemy', 100));
    const out = w.add(new Dummy(w, 200, FLOOR, 'enemy', 100));
    const friend = w.add(new Dummy(w, 105, FLOOR, 'player', 100));
    w.update();
    const n = w.damageArea({ x: 100, y: 160, r: 40 }, { amount: 10, kind: 'explosion', dirX: 0 }, 'player', 0.5);
    expect(n).toBe(2);
    expect(close.hits).toHaveLength(1);
    expect(close.hp).toBe(90);
    expect(edge.hits).toHaveLength(1);
    expect(edge.hp).toBeGreaterThan(90);
    expect(edge.hits[0].d.dirX).toBe(1);
    expect(out.hits).toHaveLength(0);
    expect(friend.hits).toHaveLength(0);
    expect(w.damageArea({ x: 180, y: 140, w: 40, h: 40 }, { amount: 1, kind: 'fire', dirX: 0 }, 'neutral')).toBe(1);
  });

  it('contact damage hurts overlapping hostiles every tick', () => {
    const w = flatWorld();
    const spiky = w.add(new Dummy(w, 100, FLOOR, 'enemy', 50));
    spiky.contactDamage = { amount: 1, kind: 'impact', dirX: 0 };
    const p = w.add(new Dummy(w, 105, FLOOR, 'player', 5));
    for (let i = 0; i < 3; i++) w.update();
    expect(p.hp).toBe(2);
    expect(spiky.hp).toBe(50);
  });

  it('god mode protects players', () => {
    const w = flatWorld();
    const p = w.add(new Dummy(w, 100, FLOOR, 'player', 1));
    p.addTag('player');
    w.update();
    w.god = true;
    expect(w.damage(p, { amount: 9, kind: 'bullet', dirX: 1 })).toBe(true);
    expect(p.hp).toBe(1);
    expect(w.nearestPlayer(0, 0)).toBe(p);
    expect(w.alivePlayers()).toEqual([p]);
  });
});

describe('World: physics integration and drawing', () => {
  it('moveSolid carries entities standing on a platform', () => {
    const w = flatWorld();
    const lift = new SolidBox(80, 150, 60, 8, true);
    w.addSolid(lift);
    const e = w.add(new Walker(w, 100, 100));
    for (let i = 0; i < 40; i++) w.update();
    expect(e.y).toBe(150);
    for (let i = 0; i < 30; i++) {
      w.moveSolid(lift, 0, -1);
      w.update();
    }
    expect(e.y).toBe(120);
    expect(e.body?.onGround).toBe(true);
  });

  it('solids owned by a removed entity are removed with it', () => {
    const w = flatWorld();
    const owner = w.add(new Dummy(w, 100, FLOOR));
    w.addSolid(new SolidBox(90, 140, 20, 30, false, owner));
    w.update();
    owner.remove();
    w.update();
    expect(w.solids).toHaveLength(0);
  });

  it('draws by z (ties: oldest first) with particles at particleZ', () => {
    const w = flatWorld();
    const drawn: string[] = [];
    class Z extends Entity {
      readonly label: string;
      constructor(world: World, z: number, label: string) {
        super(world, 0, 0);
        this.z = z;
        this.label = label;
      }
      override draw(_r: Renderer): void {
        drawn.push(this.label);
      }
    }
    w.add(new Z(w, 60, 'fx'));
    w.add(new Z(w, 30, 'enemy1'));
    w.add(new Z(w, 40, 'player'));
    w.add(new Z(w, 30, 'enemy2'));
    w.update();
    w.particles.sparks(10, 10, 3);
    const r = new RecordingRenderer();
    w.draw(r);
    expect(drawn).toEqual(['enemy1', 'enemy2', 'player', 'fx']);
    // Particles (rects) come after the player and before the fx entity.
    expect(r.calls.filter((c) => c.op === 'rect').length).toBe(3);
  });
});
