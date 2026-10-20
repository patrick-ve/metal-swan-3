/**
 * Items of the content slice: the breakable crate and its contents, the pickups, the hostage.
 */
import { describe, expect, it } from 'vitest';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import '../../src/game/content/infantry/index';
import {
  BIND_IDS,
  contentsSpecs,
  Crate,
  DROP_TABLES,
  FOOD_SCORE,
  GEM_SCORE,
  HOSTAGE_KINDS,
  REPAIR_SHARE,
  repairWanted,
  weaponForLetter,
  withVehicleDrops,
} from '../../src/game/content/items/index';
import { Hostage, BindTarget } from '../../src/game/hostage';
import { Pickup } from '../../src/game/pickup';
import { Player } from '../../src/game/player/player';
import { Enemy } from '../../src/game/enemy';
import { Vehicle } from '../../src/game/vehicle';
import { MAX_LIVES } from '../../src/game/session';
import { defineEntity, hasEntity, hasWeapon, type SpawnParams } from '../../src/game/registry';
import { frameCount, hasSprite } from '../../src/engine/sprites';
import { World } from '../../src/engine/world';
import { FLOOR, TestWorld } from './helpers';

const hit = (amount: number, owner = 0) => ({ amount, kind: 'bullet' as const, dirX: 1, owner });

describe('crate', () => {
  it('takes three pistol shots, scores 100 and drops its weapon', () => {
    const tw = new TestWorld({ playerX: 40 });
    const crate = tw.spawn('crate', 300, { contains: 'machine-gun' }) as Crate;
    expect(crate).toBeInstanceOf(Crate);
    tw.world.damage(crate, hit(10));
    tw.world.damage(crate, hit(10));
    expect(crate.broken).toBe(false);
    tw.world.damage(crate, hit(10));
    expect(crate.broken).toBe(true);
    expect(tw.session.slots[0].score).toBe(100);
    tw.run(2);
    const drops = tw.ofType('pickup-weapon');
    expect(drops.length).toBe(1);
    // Broken crates are not targets any more and leave after their break animation.
    expect(crate.alive).toBe(false);
    tw.run(90);
    expect(crate.removed).toBe(true);
  });

  it('is knifed by a player standing next to it (it is soft)', () => {
    const tw = new TestWorld({ playerX: 290 });
    const crate = tw.spawn('crate', 306, { contains: 'bombs' }) as Crate;
    const bombs = tw.session.slots[0].bombs;
    tw.hold('fire').run(1).hold().run(2);
    expect(crate.broken).toBe(true);
    // The bombs pop out right at the player's feet and are collected at once.
    tw.run(30);
    expect(tw.session.slots[0].bombs).toBe(bombs + 10);
  });

  it('never counts as an enemy kill and never holds a wave', () => {
    const tw = new TestWorld({ playerX: 40 });
    const crate = tw.spawn('crate', 300, { contains: 'gem' });
    expect(crate.hasTag('enemy')).toBe(false);
    expect(tw.world.countAlive('enemy')).toBe(0);
    tw.world.damage(crate, hit(100));
    expect(tw.session.slots[0].stats.kills).toBe(0);
  });

  it('understands letters, items, kinds and drop tables', () => {
    const w = new World({ seed: 5 });
    expect(weaponForLetter('M')).toBe('machine-gun');
    expect(contentsSpecs('M', w)).toEqual([{ id: 'pickup-weapon', params: { weapon: 'machine-gun' } }]);
    expect(contentsSpecs('machine-gun', w)).toEqual([{ id: 'pickup-weapon', params: { weapon: 'machine-gun' } }]);
    expect(contentsSpecs('bombs', w)).toEqual([{ id: 'pickup-bombs' }]);
    expect(contentsSpecs('teacake', w)).toEqual([{ id: 'pickup-food', params: { kind: 'teacake' } }]);
    expect(contentsSpecs('medal', w)).toEqual([{ id: 'pickup-gem', params: { kind: 'medal' } }]);
    expect(contentsSpecs({ id: 'hostage', params: { gives: 'bombs' } }, w)).toEqual([{ id: 'hostage', params: { gives: 'bombs' } }]);
    expect(contentsSpecs('none', w)).toEqual([]);
    // 'auto' rolls the crate table with the gameplay rng: same seed, same result.
    const a = contentsSpecs('auto', new World({ seed: 9 }));
    const b = contentsSpecs('auto', new World({ seed: 9 }));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('pickups', () => {
  it('pickup-weapon gives the weapon and 500 points', () => {
    const tw = new TestWorld({ playerX: 100 });
    tw.spawn('pickup-weapon', 104, { weapon: 'machine-gun' });
    tw.run(3);
    expect(tw.session.slots[0].weapon).toBe('machine-gun');
    expect(tw.session.slots[0].score).toBe(500);
  });

  it('pickup-bombs adds 10 bombs', () => {
    const tw = new TestWorld({ playerX: 100 });
    const before = tw.session.slots[0].bombs;
    tw.spawn('pickup-bombs', 104);
    tw.run(3);
    expect(tw.session.slots[0].bombs).toBe(before + 10);
  });

  it.each(Object.entries(FOOD_SCORE))('pickup-food %s scores %i', (kind, points) => {
    const tw = new TestWorld({ playerX: 100 });
    tw.spawn('pickup-food', 104, { kind });
    tw.run(3);
    expect(tw.session.slots[0].score).toBe(points);
  });

  it.each(Object.entries(GEM_SCORE))('pickup-gem %s scores %i', (kind, points) => {
    const tw = new TestWorld({ playerX: 100 });
    tw.spawn('pickup-gem', 104, { kind });
    tw.run(3);
    expect(tw.session.slots[0].score).toBe(points);
  });
});

describe('hostage', () => {
  it('is freed by a touch (+500), hands over its gift and counts as rescued', () => {
    const tw = new TestWorld({ playerX: 100 });
    const h = tw.spawn('hostage', 110, { gives: 'bombs' }) as Hostage;
    expect(h).toBeInstanceOf(Hostage);
    tw.run(2);
    expect(h.state).not.toBe('tied');
    expect(tw.session.slots[0].score).toBe(500);
    tw.until(() => tw.ofType('pickup-bombs').length > 0, 200);
    expect(tw.session.slots[0].rescued).toBe(1);
  });

  it('is freed by a player shot passing through it', () => {
    const tw = new TestWorld({ playerX: 100 });
    const h = tw.spawn('hostage', 200, { gives: 'gem' }) as Hostage;
    tw.hold('fire').run(1).hold().run(30);
    expect(h.state).not.toBe('tied');
  });

  it('a hostage gift may be any entity spec (a weapon by id)', () => {
    const tw = new TestWorld({ playerX: 100 });
    const h = tw.spawn('hostage', 110, { gives: 'machine-gun' }) as Hostage;
    expect(h.item).toEqual({ id: 'pickup-weapon', params: { weapon: 'machine-gun' } });
  });

  it('stands on the floor', () => {
    const tw = new TestWorld({ playerX: null });
    const h = tw.spawn('hostage', 300, {});
    tw.run(30);
    expect(h.y).toBe(FLOOR);
  });
});

// ---------------------------------------------------------------------------------------------
// Full item set (GDD §7, §14.3, §15.3)
// ---------------------------------------------------------------------------------------------

/** A ship that turns weapon medallions into its own ammo (like the Trumpeter's dive bombs). */
class ItemTestShip extends Vehicle {
  converted: string[] = [];
  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, { art: 'vehicle/test-tank', w: 36, h: 26, seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20], cells: 3 });
  }
  weaponPickup(weapon?: string): boolean {
    this.converted.push(weapon ?? '?');
    return true;
  }
}
defineEntity('item-test-ship', (w, x, y, p) => new ItemTestShip(w, x, y, p), { category: 'vehicle' });

const specIds = (specs: { id: string; params?: Record<string, unknown> }[]) =>
  specs.map((s) => (s.params?.kind ? `${s.id}:${String(s.params.kind)}` : s.params?.weapon ? `${s.id}:${String(s.params.weapon)}` : s.id));

function rollMany(table: string, n = 600, seed = 3): Map<string, number> {
  const w = new World({ seed });
  const out = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const ids = specIds(DROP_TABLES[table](w));
    const key = ids.length ? ids.join('+') : 'nothing';
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

describe('ids and sprites (GDD §15.3, §15.6)', () => {
  it('registers every item id', () => {
    for (const id of ['crate', 'hostage', 'pickup-weapon', 'pickup-bombs', 'pickup-food', 'pickup-gem', 'pickup-1up', 'pickup-repair', 'loot']) {
      expect(hasEntity(id), id).toBe(true);
    }
    expect(Object.keys(DROP_TABLES).sort()).toEqual(['crate', 'officer', 'table-a', 'table-b', 'table-c', 'table-d', 'truck']);
  });

  it('every hostage kind has the contract strips, a 2-frame bow and a 4-frame gag, plus every bind strip', () => {
    for (const kind of HOSTAGE_KINDS) {
      for (const anim of ['tied', 'freed', 'walk', 'give', 'run', 'caged', 'sack', 'mast', 'dangle', 'chute']) {
        expect(hasSprite(`item/hostage/${kind}/${anim}`), `${kind}/${anim}`).toBe(true);
      }
      // Anim wave (group npc, PEOPLE): the tourist (mission ams) bows in 5 tweened frames.
      expect(frameCount(`item/hostage/${kind}/bow`), `${kind}/bow`).toBe(kind === 'tourist' ? 5 : 2);
      expect(frameCount(`item/hostage/${kind}/gag`), `${kind}/gag`).toBe(4);
    }
    expect(BIND_IDS).toEqual(['chair', 'cage', 'sack', 'float', 'balloon']);
  });

  it('every pickup has its sprite: a medallion per crate letter, food, gems, 1up, repair', () => {
    for (const letter of 'MSRFLHTB') {
      const weapon = weaponForLetter(letter);
      if (!weapon) continue; // the weapons agent registers the rest
      expect(hasSprite(`item/pickup-weapon/${weapon}`), weapon).toBe(true);
    }
    for (const kind of Object.keys(FOOD_SCORE)) expect(hasSprite(`item/pickup-food/${kind}`), kind).toBe(true);
    for (const kind of Object.keys(GEM_SCORE)) expect(hasSprite(`item/pickup-gem/${kind}`), kind).toBe(true);
    for (const id of ['item/pickup-bombs', 'item/pickup-1up', 'item/pickup-repair', 'item/crate', 'item/crate-legion', 'item/crate-break']) {
      expect(hasSprite(id), id).toBe(true);
    }
    expect(frameCount('item/pickup-food/jelly')).toBe(2); // the 2-frame wobble
  });
});

describe('drop tables (GDD §7.3)', () => {
  it('table-b (roadie) always gives a weapon; officer a medal; truck bombs or nothing', () => {
    for (const k of rollMany('table-b').keys()) expect(k.startsWith('pickup-weapon:')).toBe(true);
    expect([...rollMany('officer').keys()]).toEqual(['pickup-gem:medal']);
    const truck = rollMany('truck');
    expect([...truck.keys()].sort()).toEqual(['nothing', 'pickup-bombs']);
    expect(Math.abs((truck.get('nothing') ?? 0) / 600 - 0.5)).toBeLessThan(0.08);
  });

  it('table-a, table-c, table-d and crate hold only their listed contents, near their weights', () => {
    const allowed: Record<string, RegExp> = {
      'table-a': /^(pickup-weapon:.+|pickup-bombs|pickup-food:(bread|cheese|teacake|jelly)|pickup-gem:(gem|medal))$/,
      'table-c': /^(pickup-food:(teacake|jelly|birthday-cake)|pickup-bombs)$/,
      'table-d': /^(pickup-gem:(gem|medal)|pickup-food:(cheese|teacake))$/,
      crate: /^(pickup-weapon:.+|pickup-bombs|pickup-food:(bread|cheese|teacake|jelly)|pickup-gem:golden-note\+pickup-gem:golden-note\+pickup-gem:golden-note)$/,
    };
    for (const [table, re] of Object.entries(allowed)) {
      for (const k of rollMany(table).keys()) expect(k, table).toMatch(re);
    }
    const share = (m: Map<string, number>, re: RegExp) => [...m].filter(([k]) => re.test(k)).reduce((a, [, n]) => a + n, 0) / 600;
    expect(share(rollMany('table-a'), /^pickup-weapon/)).toBeCloseTo(0.4, 1);
    expect(share(rollMany('table-c'), /^pickup-food/)).toBeCloseTo(0.6, 1);
    expect(share(rollMany('table-d'), /^pickup-gem/)).toBeCloseTo(0.7, 1);
    expect(share(rollMany('crate'), /golden-note/)).toBeCloseTo(0.15, 1);
  });

  it('every crate letter is always that weapon (B = Bounce Mines)', () => {
    const w = new World({ seed: 1 });
    for (const letter of 'MSRFLHTB') {
      const weapon = weaponForLetter(letter);
      if (!weapon || !hasWeapon(weapon)) continue;
      expect(contentsSpecs(letter, w)).toEqual([{ id: 'pickup-weapon', params: { weapon } }]);
    }
    expect(contentsSpecs('1up', w)).toEqual([{ id: 'pickup-1up' }]);
    expect(contentsSpecs('repair', w)).toEqual([{ id: 'pickup-repair' }]);
  });

  it("loot becomes the rolled item (an enemy's drop: { id: 'loot', params: { contains: 'officer' } })", () => {
    const tw = new TestWorld({ playerX: null });
    const e = tw.spawn('loot', 300, { contains: 'officer', dropped: true });
    expect(e).toBeInstanceOf(Pickup);
    expect(e.type).toBe('pickup-gem');
    const none = tw.spawn('loot', 340, { contains: 'none' });
    tw.run(2);
    expect(none.removed).toBe(true);
  });
});

describe('pickup rules (GDD §7.1, §14.3)', () => {
  it('a dropped item pops, lands, blinks and vanishes after 720 ticks; a placed one stays', () => {
    const tw = new TestWorld({ playerX: null });
    const dropped = tw.spawn('pickup-food', 300, { kind: 'bread', dropped: true });
    const placed = tw.spawn('pickup-food', 400, { kind: 'bread' });
    tw.run(719);
    expect(dropped.removed).toBe(false);
    tw.run(3);
    expect(dropped.removed).toBe(true);
    expect(placed.removed).toBe(false);
  });

  it('a floating golden note hangs at its placed y (no gravity), a plain one falls', () => {
    const tw = new TestWorld({ playerX: null });
    const float = tw.spawn('pickup-gem', 300, { kind: 'golden-note', float: true }, 100);
    const plain = tw.spawn('pickup-gem', 400, { kind: 'golden-note' }, 100);
    tw.run(240);
    expect(float.y).toBe(100);
    expect(plain.y).toBeGreaterThan(150);
  });

  it('pickup-1up waddles toward the nearest player at 0.5 px/tick and gives a life', () => {
    const tw = new TestWorld({ playerX: 100 });
    const up = tw.spawn('pickup-1up', 300);
    tw.run(40);
    const x0 = up.x;
    tw.run(20);
    expect(x0 - up.x).toBeCloseTo(10, 0);
    const lives = tw.session.slots[0].lives;
    tw.until(() => up.removed, 600);
    expect(tw.session.slots[0].lives).toBe(lives + 1);
    expect(tw.session.slots[0].score).toBe(0);
  });

  it('pickup-1up with full lives scores 10,000', () => {
    const tw = new TestWorld({ playerX: 100 });
    tw.session.slots[0].lives = MAX_LIVES;
    tw.spawn('pickup-1up', 104);
    tw.run(3);
    expect(tw.session.slots[0].lives).toBe(MAX_LIVES);
    expect(tw.session.slots[0].score).toBe(10000);
  });

  it('pickup-repair on foot scores 1,000; riding it adds a cell', () => {
    const tw = new TestWorld({ playerX: 100 });
    tw.spawn('pickup-repair', 104);
    tw.run(3);
    expect(tw.session.slots[0].score).toBe(1000);
    const ship = tw.spawn('item-test-ship', 100) as ItemTestShip;
    ship.mount(tw.player as Player);
    ship.cells = 1;
    tw.spawn('pickup-repair', 104, {}, FLOOR - 20);
    tw.run(10);
    expect(ship.cells).toBe(2);
  });

  it('grenades cap at 99', () => {
    const tw = new TestWorld({ playerX: 100 });
    tw.session.slots[0].bombs = 95;
    tw.spawn('pickup-bombs', 104);
    tw.run(3);
    expect(tw.session.slots[0].bombs).toBe(99);
  });

  it('riding a ship that converts weapons: the medallion becomes its ammo, the weapon stays', () => {
    const tw = new TestWorld({ playerX: 100 });
    const ship = tw.spawn('item-test-ship', 100) as ItemTestShip;
    ship.mount(tw.player as Player);
    tw.spawn('pickup-weapon', 104, { weapon: 'machine-gun' }, FLOOR - 20);
    tw.run(10);
    expect(ship.converted).toEqual(['machine-gun']);
    expect(tw.session.slots[0].weapon).toBe('pistol');
    expect(tw.session.slots[0].score).toBe(500);
  });
});

describe('hostage kinds and binds (GDD §7.2)', () => {
  it('default gifts: composer the 1up, roadie a weapon; each kind rolls its own table', () => {
    const tw = new TestWorld({ playerX: null });
    expect((tw.spawn('hostage', 300, { kind: 'composer' }) as Hostage).item?.id).toBe('pickup-1up');
    for (let i = 0; i < 20; i++) expect((tw.spawn('hostage', 300, { kind: 'roadie' }) as Hostage).item?.id).toBe('pickup-weapon');
    for (let i = 0; i < 20; i++) {
      const tea = (tw.spawn('hostage', 300, { kind: 'tea-lady' }) as Hostage).item;
      expect(['pickup-food', 'pickup-bombs']).toContain(tea?.id);
      if (tea?.id === 'pickup-food') expect(['teacake', 'jelly', 'birthday-cake']).toContain(tea.params?.kind);
    }
    // An exact drop wins over the table.
    expect((tw.spawn('hostage', 300, { kind: 'roadie', drop: 'cheese' }) as Hostage).item).toEqual({ id: 'pickup-food', params: { kind: 'cheese' } });
  });

  it.each(HOSTAGE_KINDS.filter((k) => k !== 'dollop'))('%s: freed +500, walks over, gag, gives, bows, runs off', (kind) => {
    const tw = new TestWorld({ playerX: 100 });
    const h = tw.spawn('hostage', 180, { kind, drop: 'bread' }) as Hostage;
    tw.hold('fire').run(1).hold();
    const seen = new Set<string>();
    tw.until(() => {
      seen.add(h.state);
      return h.removed;
    }, 900);
    expect(tw.session.slots[0].score).toBeGreaterThanOrEqual(500);
    expect(tw.session.slots[0].rescued).toBe(1);
    for (const s of ['freed', 'walk', 'give', 'bow', 'run']) expect(seen.has(s), s).toBe(true);
    expect(seen.has('gag')).toBe(true);
  });

  it('tourist: SAY CHEESE freezes every non-boss enemy on screen in the photo pose for 45 ticks', () => {
    const tw = new TestWorld({ playerX: 100 });
    const enemy = tw.spawn('rifleman', 300, { gag: 'nap' }) as Enemy;
    const far = tw.spawn('rifleman', 1200) as Enemy;
    const h = tw.spawn('hostage', 110, { kind: 'tourist', drop: 'none' }) as Hostage;
    tw.until(() => h.state === 'gag', 120);
    tw.until(() => enemy.reaction === 'photo', 40);
    expect(far.reaction).not.toBe('photo');
  });

  it('cage: shooting the rope (10 HP) drops the cage, which breaks and frees the hostage', () => {
    const tw = new TestWorld({ playerX: 100 });
    const h = tw.spawn('hostage', 300, { bind: 'cage', drop: 'none' }, 110) as Hostage;
    tw.run(2);
    const rope = tw.ofType('hostage-rope')[0] as BindTarget;
    expect(rope).toBeDefined();
    tw.world.damage(rope, hit(9));
    expect(h.state).toBe('tied');
    tw.world.damage(rope, hit(1));
    tw.until(() => h.state === 'freed' || h.state === 'walk', 200);
    expect(h.y).toBe(FLOOR);
    expect(tw.session.slots[0].rescued).toBe(1);
  });

  it('sack: hops blindly inside its 48 px band; a touch frees', () => {
    const tw = new TestWorld({ playerX: 40 });
    const h = tw.spawn('hostage', 300, { bind: 'sack', drop: 'none' }) as Hostage;
    let lo = h.x;
    let hi = h.x;
    for (let i = 0; i < 1200; i++) {
      tw.run(1);
      lo = Math.min(lo, h.x);
      hi = Math.max(hi, h.x);
    }
    expect(h.state).toBe('tied');
    expect(hi - lo).toBeGreaterThan(8);
    expect(hi - lo).toBeLessThanOrEqual(48.01);
    (tw.player as Player).x = h.x;
    tw.run(2);
    expect(h.state).not.toBe('tied');
  });

  it('float: both ropes must be shot (10 HP each)', () => {
    const tw = new TestWorld({ playerX: 40 });
    const h = tw.spawn('hostage', 300, { bind: 'float', drop: 'none' }) as Hostage;
    tw.run(2);
    const ropes = tw.ofType('hostage-rope') as BindTarget[];
    expect(ropes.length).toBe(2);
    tw.world.damage(ropes[0], hit(10));
    tw.run(2);
    expect(h.state).toBe('tied');
    tw.world.damage(ropes[1], hit(10));
    tw.run(2);
    expect(h.state).not.toBe('tied');
  });

  it('balloon: drifts left at 0.5 px/tick; the shot rope sends the hostage down by parachute and the gift up to the player', () => {
    const tw = new TestWorld({ playerX: 100 });
    const h = tw.spawn('hostage', 400, { bind: 'balloon', drop: 'gem' }, 90) as Hostage;
    tw.run(2);
    const x0 = h.x;
    tw.run(20);
    expect(x0 - h.x).toBeCloseTo(10, 0);
    const rope = tw.ofType('hostage-rope')[0] as BindTarget;
    tw.world.damage(rope, hit(10));
    tw.until(() => tw.session.slots[0].score >= 500 + 1000, 400);
    expect(tw.session.slots[0].rescued).toBe(1);
  });

  it('a chair hostage is never hurt and never blocks shots (team neutral)', () => {
    const tw = new TestWorld({ playerX: null });
    const h = tw.spawn('hostage', 300, {}) as Hostage;
    expect(h.team).toBe('neutral');
    expect(h.hasTag('enemy')).toBe(false);
  });

  it('the rescuer died: it walks to the other living player', () => {
    const tw = new TestWorld({ playerX: 100 });
    const p2 = new Player(tw.world, 400, FLOOR, { pad: tw.pad, index: 1 });
    tw.world.add(p2);
    p2.placeAt(400, FLOOR, 0);
    tw.world.flush();
    const h = tw.spawn('hostage', 250, { drop: 'none' }) as Hostage;
    h.free(0);
    (tw.player as Player).remove();
    tw.until(() => h.state === 'walk', 60);
    tw.run(10);
    expect(h.vx).toBeGreaterThan(0);
  });

  it('runs off left and fades at the level start instead of turning back', () => {
    const tw = new TestWorld({ playerX: 60 });
    const h = tw.spawn('hostage', 70, { drop: 'none' }) as Hostage;
    tw.until(() => h.state === 'run', 200);
    let maxX = h.x;
    tw.until(() => {
      maxX = Math.max(maxX, h.x);
      return h.removed;
    }, 300);
    expect(maxX).toBeLessThanOrEqual(80);
  });

  it('30 hostages and 30 pickups cost under 0.5 ms per tick', () => {
    const tw = new TestWorld({ playerX: null, width: 3200 });
    for (let i = 0; i < 30; i++) {
      tw.spawn('hostage', 100 + i * 20, { kind: HOSTAGE_KINDS[i % HOSTAGE_KINDS.length], bind: BIND_IDS[i % 4] });
      tw.spawn('pickup-gem', 100 + i * 20, { kind: 'golden-note', float: true }, 120);
    }
    tw.run(60);
    const t0 = performance.now();
    tw.run(300);
    expect((performance.now() - t0) / 300).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------------------------
// The ams extras (docs/design/ams-extras.md §6, §7.6)
// ---------------------------------------------------------------------------------------------

/** A test world with player 1 mounted on a 3-cell ship at x; `cells` left. */
function riderWorld(x: number, cells = 3, mission = 'ams'): { tw: TestWorld; ship: ItemTestShip } {
  const tw = new TestWorld({ playerX: x - 80 });
  tw.session.startMission(mission);
  const ship = tw.spawn('item-test-ship', x) as ItemTestShip;
  tw.run(1);
  ship.mount(tw.player as Player);
  tw.run(2);
  ship.cells = cells;
  return { tw, ship };
}

describe('a mounted player frees a tied hostage by touch (bug 7.6)', () => {
  for (const bind of ['chair', 'sack'] as const) {
    it(`${bind}: the vehicle body overlapping it frees it (+1 tally); apart, it stays tied`, () => {
      const { tw, ship } = riderWorld(300);
      const p = tw.player as Player;
      expect(p.state).toBe('mounted');
      const h = tw.spawn('hostage', 500, { bind, drop: 'none', band: 0 }) as Hostage;
      tw.run(30);
      expect(h.state).toBe('tied');
      ship.x = h.x - 6;
      tw.run(2);
      expect(h.state).not.toBe('tied');
      expect(tw.session.slots[0].rescued).toBe(1);
      expect(tw.world.errors).toEqual([]);
    });
  }

  it('a bind that a touch does not free (float) stays tied under the vehicle', () => {
    const { tw, ship } = riderWorld(300);
    const h = tw.spawn('hostage', 500, { bind: 'float', drop: 'none' }) as Hostage;
    tw.run(2);
    ship.x = h.x;
    tw.run(4);
    expect(h.state).toBe('tied');
  });
});

describe('vehicle-state drops (ams extras §6)', () => {
  const share = (tw: TestWorld, n = 600): number => {
    let k = 0;
    for (let i = 0; i < n; i++) if (DROP_TABLES.crate(tw.world).some((s) => s.id === 'pickup-repair')) k++;
    return k / n;
  };

  it(`a rider with a damaged vehicle in ams: the crate table gives pickup-repair in about ${REPAIR_SHARE * 100} % of the rolls`, () => {
    const { tw } = riderWorld(300, 1);
    expect(repairWanted(tw.world)).toBe(true);
    expect(Math.abs(share(tw) - REPAIR_SHARE)).toBeLessThan(0.06);
  });

  it('full cells, on foot or another mission: no repair rolls and the rng sequence is untouched', () => {
    const full = riderWorld(300, 3).tw;
    const other = riderWorld(300, 1, 'm2').tw;
    const foot = new TestWorld({ playerX: 100 });
    foot.session.startMission('ams');
    for (const tw of [full, other, foot]) {
      expect(repairWanted(tw.world)).toBe(false);
      // The same rng state gives the same rolls as a world without the rule (no extra roll).
      const a = new World({ seed: 77 });
      tw.world.rng.setState(a.rng.getState());
      for (let i = 0; i < 20; i++) expect(specIds(DROP_TABLES.crate(tw.world)).join('+')).toBe(specIds(DROP_TABLES.crate(a)).join('+'));
      expect(share(tw, 200)).toBe(0);
    }
  });

  it('withVehicleDrops swaps only food / gem drops (about 30 %) and passes other drops without a roll', () => {
    const { tw } = riderWorld(300, 2);
    let swapped = 0;
    for (let i = 0; i < 600; i++) {
      const out = withVehicleDrops(tw.world, [{ id: 'pickup-gem', params: { kind: 'gem' } }]);
      if (out[0].id === 'pickup-repair') swapped++;
    }
    expect(Math.abs(swapped / 600 - REPAIR_SHARE)).toBeLessThan(0.06);
    const bombs = [{ id: 'pickup-bombs' }];
    expect(withVehicleDrops(tw.world, bombs)).toBe(bombs);
    expect(withVehicleDrops(tw.world, [])).toEqual([]);
  });
});
