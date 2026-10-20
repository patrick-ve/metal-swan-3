/**
 * The gloat (docs/design/ams-extras.md §1): while every player is out the Amsterdam locals on
 * screen go about their own business at the spot where the last player went down — the
 * handhaver walks there (≤ 40 px, his own floor), writes, tears the page off and lets it flutter
 * onto the spot (`VERBODEN TE LIGGEN!` once per hold); the gull lands and pecks; the riders stay
 * in view (the youth wheelies, the delivery rider circles once and checks his phone). Nobody
 * attacks; a hero dropping back in (the cower) ends it cleanly. No 'laugh' reaction is left.
 * And two locals bugs (§7.4, §7.5): a rider over deep water falls in (a splash, gone, no score);
 * a driven vehicle breaks a handhaver by contact.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import type { World } from '../../src/engine/world';
import { hudOf } from '../../src/game/context';
import { everyEnemyReacts, gloatHoldOf, reactInArea, startGloatHold, type Enemy, type ReactionKind } from '../../src/game/enemy';
import { defineEntity, type SpawnParams } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { Vehicle } from '../../src/game/vehicle';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/items/index';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { DeliveryRider, FatbikeYouth, Handhaver, Seagull } from '../../src/game/content/locals/index';
import { GloatPage, HANDHAVER } from '../../src/game/content/locals/handhaver';
import { FLOOR, TestWorld } from './helpers';

const C = TUNING.continues;

/** Run a gloat hold like the runner: a new hold, then a gloat renewed every `gloatEvery` ticks. */
function hold(tw: TestWorld, spot: Entity, ticks: number, each?: (t: number) => void): void {
  startGloatHold(tw.world);
  for (let t = 1; t <= ticks; t++) {
    if (t % C.gloatEvery === 1) reactInArea(tw.world, tw.world.camera.view(), 'gloat', C.gloatTicks, { onScreen: true, source: spot });
    tw.run(1);
    each?.(t);
  }
}

/** The hero is back: the cower (as the runner's landing). */
function cower(tw: TestWorld, spot: Entity): void {
  reactInArea(tw.world, tw.world.camera.view(), 'cower', C.cowerTicks, { onScreen: true, source: spot });
}

/** Count the gag bubbles shown with `text`. */
function countLines(world: World, text: string): { n: number } {
  const hud = hudOf(world);
  const box = { n: 0 };
  const orig = hud.bubble.bind(hud);
  hud.bubble = (target, t, o) => {
    if (t === text) box.n++;
    return orig(target, t, o);
  };
  return box;
}

/** Enemy shots and tickets spawned (any attack that leaves the enemy). */
function watchShots(world: World): { n: number } {
  const box = { n: 0 };
  world.events.on('spawn', (e) => {
    if (e.team === 'enemy' && (e.type === 'boete-ticket' || e.hasTag('projectile'))) box.n++;
  });
  return box;
}

/** A tiny driven vehicle (the Swan stands in for any player vehicle). */
class GloatTestCar extends Vehicle {
  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, { art: 'vehicle/test-car', w: 36, h: 26, seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20], cells: 4 });
  }
}
defineEntity('gloat-test-car', (w, x, y, p) => new GloatTestCar(w, x, y, p), { category: 'vehicle' });

describe('the gloat replaces the laugh', () => {
  it("every enemy answers 'gloat' (and 'cower'); 'laugh' is gone from the reactions and the tuning", () => {
    expect(everyEnemyReacts('gloat')).toBe(true);
    expect(everyEnemyReacts('cower')).toBe(true);
    expect(everyEnemyReacts('laugh' as ReactionKind)).toBe(false);
    const tw = new TestWorld({ god: true, playerX: 100 });
    const h = tw.spawn('handhaver', 200) as Enemy;
    expect(h.react('laugh' as ReactionKind, 10)).toBe(false);
    expect(h.react('gloat', 10, tw.player)).toBe(true);
    expect(Object.keys(C).filter((k) => /laugh/i.test(k))).toEqual([]);
    expect([C.gloatEvery, C.gloatTicks]).toEqual([15, 24]);
  });

  it('a hold number per world: startGloatHold counts up', () => {
    const tw = new TestWorld({ god: true });
    expect(gloatHoldOf(tw.world)).toBe(0);
    expect(startGloatHold(tw.world)).toBe(1);
    expect(startGloatHold(tw.world)).toBe(2);
    expect(gloatHoldOf(new TestWorld({ god: true }).world)).toBe(0);
  });
});

describe('the handhaver gloat', () => {
  it('walks to the spot (stops short of it), writes, tears the page off and it flutters onto the spot; one line per hold', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const h = tw.spawn('handhaver', 140) as Handhaver;
    const lines = countLines(tw.world, 'VERBODEN TE LIGGEN!');
    const shots = watchShots(tw.world);
    const x0 = h.x;
    let maxWalk = 0;
    let wrote = false;
    hold(tw, spot, 260, () => {
      maxWalk = Math.max(maxWalk, Math.abs(h.x - x0));
      if (h.anim.id === `${h.art}/gloat` && h.anim.index <= 1) wrote = true;
      expect(h.y).toBe(FLOOR);
      expect(h.reaction).toBe('gloat');
    });
    expect(maxWalk).toBeLessThanOrEqual(HANDHAVER.gloatWalk);
    expect(Math.abs(h.x - (spot.x + HANDHAVER.gloatStand))).toBeLessThanOrEqual(HANDHAVER.walk);
    expect(h.facing).toBe(-1);
    expect(wrote).toBe(true);
    expect(lines.n).toBe(1);
    const pages = tw.world.entities.filter((e): e is GloatPage => e instanceof GloatPage);
    expect(pages.length).toBe(1);
    expect(pages[0].landed).toBe(true);
    expect(pages[0].x).toBe(spot.x);
    expect(pages[0].y).toBeLessThan(FLOOR);
    expect(pages[0].y).toBeGreaterThan(FLOOR - 6);
    // He stands back with the book shut.
    expect(h.anim.id).toBe(`${h.art}/gloat`);
    expect(h.anim.index).toBe(4);
    expect(shots.n).toBe(0);
    // A second hold: one more line (once per hold), not one per renewal.
    cower(tw, spot);
    tw.run(C.cowerTicks + 2);
    expect(h.reaction).toBe(null);
    hold(tw, spot, 120);
    expect(lines.n).toBe(2);
  });

  it('walks at most 40 px and never off his floor', () => {
    const tw = new TestWorld({
      god: true,
      playerX: 60,
      noFloor: true,
      build: (t) => {
        t.ground().at(0, FLOOR).flat(150).step(-24).flat(1500);
      },
    });
    const spot = tw.player!;
    // Far away on the flat: 40 px, no more.
    const far = tw.spawn('handhaver', 300, {}, FLOOR - 24) as Handhaver;
    // Up on the step, the spot below him: he stops at the edge of his floor.
    const edge = tw.spawn('handhaver', 170, {}, FLOOR - 24) as Handhaver;
    hold(tw, spot, 200);
    expect(far.x).toBeCloseTo(260, 0);
    expect(far.y).toBe(FLOOR - 24);
    expect(edge.x).toBeGreaterThan(150);
    expect(edge.y).toBe(FLOOR - 24);
  });

  it('ends cleanly when the hero is back: he cowers, then walks and throws again', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const h = tw.spawn('handhaver', 150) as Handhaver;
    const shots = watchShots(tw.world);
    hold(tw, spot, 90);
    expect(shots.n).toBe(0);
    cower(tw, spot);
    expect(h.reaction).toBe('cower');
    expect(h.mode).toBe('walk');
    tw.run(C.cowerTicks);
    tw.until(() => shots.n > 0, 400);
  });
});

describe('the gull gloat', () => {
  it('flies to the spot, lands beside it and pecks; the cower lifts it off again', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const g = tw.spawn('seagull', 260) as Seagull;
    const shots = watchShots(tw.world);
    hold(tw, spot, 240, () => expect(g.contactDamage).toBe(null));
    expect(g.anim.id).toBe('enemy/seagull/gloat');
    expect(g.y).toBe(FLOOR);
    expect(g.x).toBeGreaterThan(spot.x);
    expect(g.x - spot.x).toBeLessThanOrEqual(10 + 2 * 14);
    expect(g.facing).toBe(-1);
    expect(shots.n).toBe(0);
    cower(tw, spot);
    expect(g.reaction).toBe('cower');
    expect(g.y).toBe(FLOOR - 11);
    tw.run(C.cowerTicks + 1);
    expect(g.mode).toBe('fly');
  });

  it('a sleeping gull on its perch wakes and goes for the fries too; with no floor under the spot it hovers', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const g = tw.spawn('seagull', 220, { perch: true }, FLOOR - 40) as Seagull;
    hold(tw, spot, 260);
    expect(g.anim.id).toBe('enemy/seagull/gloat');
    expect(g.y).toBe(FLOOR);
    // Over a pit: it hovers above the spot instead of landing.
    const pit = new TestWorld({ god: true, playerX: 100, noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(40).gap(200).flat(1400) });
    const p2 = pit.player!;
    p2.x = 120;
    const g2 = pit.spawn('seagull', 300, { awake: true }, FLOOR - 40) as Seagull;
    hold(pit, p2, 200);
    expect(g2.anim.id).toBe('enemy/seagull/idle');
    expect(g2.y).toBeLessThan(FLOOR - 20);
  });
});

describe('the rider gloats', () => {
  it('the fatbike youth wheelies in place facing the spot, the speaker thumping; no kick', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const y = tw.spawn('fatbike-youth', 220) as FatbikeYouth;
    tw.run(2);
    const audio = tw.world.audio as unknown as { log?: string[] };
    const x0 = y.x;
    hold(tw, spot, 120, () => expect(y.contactDamage).toBe(null));
    expect(y.anim.id).toBe(`${y.art}/gloat`);
    expect(Math.abs(y.x - x0)).toBeLessThan(3);
    expect(y.facing).toBe(-1);
    if (audio.log) expect(audio.log.filter((s) => s === 'sfx:ams/bass-thump').length).toBeGreaterThanOrEqual(3);
  });

  it('the delivery rider rings, circles once (out and back) inside the view, then checks his phone', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const d = tw.spawn('delivery-rider', 250, { facing: 'right', gag: false }) as DeliveryRider;
    tw.run(1);
    const xs: number[] = [];
    let flips = 0;
    let last = d.facing;
    hold(tw, spot, 150, () => {
      xs.push(d.x);
      if (d.facing !== last) flips++;
      last = d.facing;
      expect(d.contactDamage).toBe(null);
      expect(d.onScreen(0)).toBe(true);
    });
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(30);
    expect(flips).toBeGreaterThanOrEqual(2);
    expect(d.anim.id).toBe(`${d.art}/gloat`);
    expect(d.vx).toBe(0);
  });

  it('a rider at the view edge rides in to stay in view', () => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const spot = tw.player!;
    const cam = tw.world.camera;
    const y = tw.spawn('fatbike-youth', cam.right - 4, { facing: 'left' }) as FatbikeYouth;
    hold(tw, spot, 90);
    expect(y.x).toBeLessThanOrEqual(cam.right - 24 + 1);
    expect(y.anim.id).toBe(`${y.art}/gloat`);
  });
});

describe('nobody attacks during the hold', () => {
  it('a mixed crowd: no shot, no ticket, no kick, no dive, the player is never hit', () => {
    const tw = new TestWorld({ god: false, playerX: 120 });
    const p = tw.player!;
    const foes = [
      tw.spawn('fatbike-youth', 200, { pair: true }),
      tw.spawn('delivery-rider', 300),
      tw.spawn('handhaver', 180),
      tw.spawn('seagull', 220, { flock: 3 }),
      tw.spawn('seagull', 160, { perch: true }, FLOOR - 40),
    ] as Enemy[];
    tw.run(1);
    const hp0 = p.hp;
    const shots = watchShots(tw.world);
    hold(tw, p, 400, () => {
      for (const e of tw.world.byTag('enemy')) expect((e as Enemy).contactDamage, e.type).toBe(null);
    });
    expect(shots.n).toBe(0);
    expect(p.hp).toBe(hp0);
    for (const f of foes) expect(f.alive).toBe(true);
    // They still take damage.
    const h = foes[2];
    tw.world.damage(h, { amount: 5, kind: 'bullet', dirX: 1, owner: 0 });
    expect(h.hp).toBe(h.maxHp - 5);
  });
});

describe('locals bugs (docs/design/ams-extras.md §7.4, §7.5)', () => {
  it('a rider whose bike leaves the quay over a deep canal falls in: a splash, removed, no score', () => {
    const tw = new TestWorld({
      god: true,
      playerX: 60,
      noFloor: true,
      width: 1200,
      build: (t) => {
        t.ground().at(0, FLOOR).flat(400).gap(200).flat(600);
        t.hazard('water', 400, FLOOR + 6, 200, 30);
      },
    });
    const d = tw.spawn('delivery-rider', 360, { facing: 'right' }) as DeliveryRider;
    const score0 = tw.session.slots[0].score;
    let killed = 0;
    tw.world.events.on('killed', () => killed++);
    tw.until(() => d.removed, 200);
    expect(d.dead).toBe(false);
    expect(d.x).toBeGreaterThan(400);
    expect(d.y).toBeLessThan(FLOOR + 6 + 30);
    expect(killed).toBe(0);
    expect(tw.session.slots[0].score).toBe(score0);
  });

  it('a driven vehicle that touches a handhaver breaks him (½ cell for the vehicle, the driver scores)', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 2000 });
    const car = tw.spawn('gloat-test-car', 150) as GloatTestCar;
    const p = tw.player!;
    p.placeAt(150, 120, 0);
    p.y = 120;
    p.body.onGround = false;
    tw.until(() => p.state === 'mounted', 120);
    const cells = car.cells;
    car.invulnTicks = 0; // the mount's invulnerable ticks
    const h = tw.spawn('handhaver', car.x + 20) as Handhaver;
    tw.until(() => h.dead, 30);
    expect(car.cells).toBe(cells - 0.5);
    expect(tw.session.slots[0].score).toBe(HANDHAVER.score);
  });

  it('…also while he gloats', () => {
    const tw = new TestWorld({ god: true, playerX: 60, width: 2000 });
    const car = tw.spawn('gloat-test-car', 150) as GloatTestCar;
    const p = tw.player!;
    p.placeAt(150, 120, 0);
    p.y = 120;
    p.body.onGround = false;
    tw.until(() => p.state === 'mounted', 120);
    const h = tw.spawn('handhaver', car.x + 20) as Handhaver;
    h.react('gloat', 60, p);
    tw.until(() => h.dead, 30);
  });
});
