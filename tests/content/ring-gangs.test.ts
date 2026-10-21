/**
 * The gangs of the ring (`ring-parcel-van`, `ring-parcel`, `ring-caravan`; docs/design/ring.md §5.2,
 * §5.4, §8, §9; GDD §4.11 fairness): registration; a plain `{}` spawn that runs (plain world and
 * ring); every attack right after its own tell of ≥ 18 ticks on screen, no shot from off screen, at
 * most the token count at once (the fairness watcher); the brake check rams a wagon in line and a
 * swerve dodges it; parcels land in the target's lane, block (1 cell) and break (some hold a crate);
 * the loose caravan swerves, tips and slides onto the hard shoulder and never covers every lane; the
 * hostage carrier flow (grille → the hostage leaps onto the roof → its gift); the beaten van; the
 * gloat (the NIET THUIS card, no attack) and the cower.
 */
import { describe, expect, it } from 'vitest';
import type { Damage, Entity } from '../../src/engine/entity';
import { attackTokenLimit } from '../../src/game/enemy';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/items/index';
import '../../src/game/content/ring/hazards/index';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/scooter/index';
import '../../src/game/content/ring/traffic/index';
import '../../src/game/content/ring/gangs/art';
import { CARAVAN, RingCaravan, RingCard, RingCourier, RingParcel, RingParcelVan, RingTowCar, VAN, VAN_AI, PARCEL_AI } from '../../src/game/content/ring/gangs/index';
import type { RingHostage } from '../../src/game/content/ring/items/hostage';
import { PlaneTumbler } from '../../src/game/content/ring/traffic/road-kit';
import { DEPTH_HALF, LANE_Y, laneY, SHOULDER_TOP } from '../../src/game/ring/lanes';
import { RING } from '../../src/game/ring/types';
import { RingRig } from '../game/ring/ring-helpers';
import { TestWorld, watchFairness, type TestWorld as TW } from './helpers';

function rig(o: { god?: boolean; lives?: number } = {}): RingRig {
  const r = new RingRig({ god: o.god, lives: o.lives });
  r.run(2);
  return r;
}

/** The fairness watcher on a ring rig. */
function asTestWorld(r: RingRig): TW {
  return { world: r.world, run: (n = 1) => r.run(n) } as unknown as TW;
}

const RAM: Damage = { amount: 10, kind: 'impact', dirX: -1, tags: ['ram'] };

function wreck(r: RingRig): void {
  const w = r.wagon;
  while (w.cells > 0) {
    w.invulnTicks = 0;
    r.world.damage(w, RAM);
  }
}

const ofType = <T extends Entity>(r: RingRig, cls: abstract new (...a: never[]) => T): T[] => r.world.entities.filter((e): e is T => e instanceof cls && !e.removed);

describe('ring gangs: registration and {} spawns', () => {
  it('registers the parcel van, the parcel and the caravan', () => {
    for (const id of ['ring-parcel-van', 'ring-parcel', 'ring-caravan']) expect(hasEntity(id), id).toBe(true);
  });

  it('runs 600 ticks from {} in a plain world and on the ring without errors', () => {
    const tw = new TestWorld({ god: true });
    for (const id of ['ring-parcel-van', 'ring-parcel', 'ring-caravan']) tw.spawn(id, 260);
    tw.run(600);
    expect(tw.world.errors.map((x) => `${x.where}: ${x.message}`)).toEqual([]);
    const r = rig({ god: true });
    r.spawnAt('ring-parcel-van', 420, laneY(2), {});
    r.spawnAt('ring-caravan', 440, laneY(4), {});
    r.spawnAt('ring-parcel', 300, laneY(1), {});
    r.spawnAt('ring-parcel-van', -60, laneY(3), { side: 'behind', crew: 'gunner', brakeCheck: true });
    r.run(600);
    expect(r.world.errors.map((x) => `${x.where}: ${x.message}`)).toEqual([]);
  });
});

describe('ring gangs: fairness', () => {
  it('every attack comes right after its own tell of ≥ 18 ticks on screen; no shot from off screen', () => {
    const r = rig({ god: true });
    const lane = r.wagon.laneTarget;
    r.spawnAt('ring-parcel-van', 300, laneY(lane), { crew: 'gunner', brakeCheck: true });
    r.spawnAt('ring-parcel-van', 420, laneY(lane === 1 ? 2 : 1), { crew: 'thrower' });
    r.spawnAt('ring-caravan', 450, laneY(4), { gunner: true, looseAfter: 600 });
    const w = watchFairness(asTestWorld(r), 2400, {
      attacks: { throw: 'tell-throw', shoot: 'tell-shoot', brake: 'tell-brake', loose: 'tell-loose' },
      tells: new Set(['tell-throw', 'tell-shoot', 'tell-brake', 'tell-loose']),
      watched: (e) => e instanceof RingParcelVan || e instanceof RingCaravan,
    });
    const kinds = new Set(w.attacks.map((a) => a.mode));
    expect(kinds.has('throw')).toBe(true);
    expect(kinds.has('shoot')).toBe(true);
    expect(kinds.has('loose')).toBe(true);
    for (const a of w.attacks) {
      expect(a.prev, `${a.id} ${a.mode}`).toBe(`tell-${a.mode}`);
      expect(a.tell, `${a.id} ${a.mode}`).toBeGreaterThanOrEqual(18);
      expect(a.tellInView, `${a.id} ${a.mode}`).toBeGreaterThanOrEqual(18);
      expect(a.inView).toBe(true);
    }
    expect(w.outsideShots).toBe(0);
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(r.world));
  });
});

describe('ring-parcel-van', () => {
  it('opens its rear doors first (≥ 18 ticks, on screen), then the thrower lobs parcels into the target lane', () => {
    const r = rig({ god: true });
    const lane = r.wagon.laneTarget;
    const v = r.spawnAt<RingParcelVan>('ring-parcel-van', 300, laneY(lane === 1 ? 2 : lane - 1), { crew: 'thrower' });
    const modes: string[] = [];
    let landed: RingParcel | null = null;
    for (let i = 0; i < 900 && !landed; i++) {
      r.run(1);
      if (modes[modes.length - 1] !== v.mode) modes.push(v.mode);
      landed = ofType(r, RingParcel)[0] ?? null;
    }
    expect(modes.indexOf('open')).toBeGreaterThan(-1);
    expect(modes.indexOf('open')).toBeLessThan(modes.indexOf('tell-throw'));
    expect(v.doorsOpen).toBe(true);
    expect(landed).not.toBeNull();
    expect(landed!.landY).toBe(laneY(r.wagon.laneTarget));
  });

  it('a parcel in the lane costs the wagon 1 cell and bursts; one beside it costs nothing', () => {
    const r = rig();
    const wg = r.wagon;
    r.until(() => wg.invulnTicks <= 0, 300);
    const lane = wg.laneTarget;
    const beside = r.spawnAt<RingParcel>('ring-parcel', wg.screenX + 120, laneY(lane === 1 ? 2 : lane - 1));
    r.run(60);
    expect(wg.cells).toBe(wg.maxCells);
    expect(beside.removed).toBe(false);
    const p = r.spawnAt<RingParcel>('ring-parcel', wg.screenX + 120, laneY(lane));
    expect(p.lying).toBe(true);
    r.until(() => p.removed, 120);
    expect(wg.cells).toBe(wg.maxCells - PARCEL_AI.cells);
  });

  it('a shot parcel breaks (score); about one in four holds a crate', () => {
    const r = rig({ god: true });
    let crates = 0;
    for (let i = 0; i < 40; i++) {
      const p = r.spawnAt<RingParcel>('ring-parcel', 300, laneY(1));
      const before = r.world.byTag('ring-crate').length;
      r.world.damage(p, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
      expect(p.removed).toBe(true);
      r.world.flush();
      crates += r.world.byTag('ring-crate').length - before;
      for (const c of r.world.byTag('ring-crate')) c.remove();
      r.run(1);
    }
    expect(crates).toBeGreaterThan(2);
    expect(crates).toBeLessThan(25);
    expect(r.session.slots[0].score).toBeGreaterThanOrEqual(40 * PARCEL_AI.score);
  });

  it('the brake check rams a wagon left in line (2 cells); a swerve dodges it', () => {
    for (const dodge of [false, true]) {
      const r = rig();
      const wg = r.wagon;
      r.until(() => wg.invulnTicks <= 0, 300);
      const lane = wg.laneTarget;
      const v = r.spawnAt<RingParcelVan>('ring-parcel-van', wg.screenX + 46 + 60 + VAN.len / 2, laneY(lane), { crew: 'none', brakeCheck: true });
      r.until(() => v.mode === 'tell-brake', 600);
      expect(v.braking).toBe(true);
      if (dodge) {
        r.until(() => v.modeT >= 18, 60);
        expect(wg.swerve(lane <= 2 ? 1 : -1)).toBe(true);
      }
      r.until(() => v.mode === 'recover' || v.mode === 'ride', 200);
      r.run(4);
      if (dodge) {
        expect(wg.cells).toBe(wg.maxCells);
        expect(wg.laneTarget).not.toBe(lane);
      } else expect(wg.cells).toBe(wg.maxCells - 2);
    }
  });

  it('beaten: score, a crate, the crew and the driver tumble out; it limps onto the shoulder and is gone', () => {
    const r = rig({ god: true });
    const v = r.spawnAt<RingParcelVan>('ring-parcel-van', 280, laneY(1), { crew: 'thrower', drop: 'S' });
    r.run(2);
    const score = r.session.slots[0].score;
    r.world.damage(v, { amount: v.hp, kind: 'bullet', dirX: 1, owner: 0 });
    expect(v.dead).toBe(true);
    expect(r.session.slots[0].score).toBe(score + VAN_AI.score);
    r.world.flush();
    expect(r.world.byTag('ring-crate').length).toBe(1);
    expect(ofType(r, PlaneTumbler).length).toBeGreaterThanOrEqual(2);
    expect(v.hurtboxes().length).toBe(0);
    r.run(200);
    expect(v.y).toBeGreaterThan(SHOULDER_TOP);
    r.until(() => v.removed, VAN_AI.limpTicks);
  });
});

describe('ring-caravan', () => {
  it('keeps to the near lanes (3–4)', () => {
    const r = rig({ god: true });
    const c = r.spawnAt<RingCaravan>('ring-caravan', 420, laneY(1), { gunner: false });
    r.run(400);
    expect(c.y).toBeGreaterThanOrEqual(LANE_Y[2] - 0.5);
  });

  it('comes loose after its tell: the tow car flees, it swerves, tips and slides onto the shoulder, never covering every lane', () => {
    for (const lane of [3, 4]) {
      const r = rig({ god: true });
      const c = r.spawnAt<RingCaravan>('ring-caravan', 300, laneY(lane), { gunner: true, looseAfter: 30 });
      const modes: string[] = [];
      let widest = 0;
      for (let i = 0; i < 700 && !c.removed; i++) {
        r.run(1);
        if (modes[modes.length - 1] !== c.mode) modes.push(c.mode);
        if (c.mode === 'loose' || c.mode === 'tip' || c.mode === 'slide') {
          // Lanes whose slab the caravan's slab touches.
          let n = 0;
          for (const ly of LANE_Y) if (Math.abs(ly - c.y) < DEPTH_HALF * 2) n++;
          widest = Math.max(widest, n);
        }
      }
      expect(modes).toEqual(expect.arrayContaining(['tell-loose', 'loose', 'tip', 'slide', 'wreck']));
      expect(modes.indexOf('tell-loose')).toBeLessThan(modes.indexOf('loose'));
      expect(widest).toBeGreaterThan(0);
      expect(widest).toBeLessThanOrEqual(2);
      expect(c.hitched).toBe(false);
      expect(c.gunnerGone).toBe(true);
    }
  });

  it('the snap sends the tow car off ahead; the wreck lies on the shoulder out of play', () => {
    const r = rig({ god: true });
    const c = r.spawnAt<RingCaravan>('ring-caravan', 300, laneY(4), { looseAfter: 20 });
    r.until(() => !c.hitched, 300);
    r.world.flush();
    const car = ofType(r, RingTowCar)[0];
    expect(car).toBeDefined();
    const x0 = car.x - r.world.camera.x;
    r.run(30);
    expect(car.removed || car.x - r.world.camera.x > x0).toBe(true);
    r.until(() => c.mode === 'wreck', 400);
    expect(c.y).toBeGreaterThanOrEqual(SHOULDER_TOP);
    expect(c.hurtboxes().length).toBe(0);
  });

  it('half its hp gone, the hitch gives; beaten it tips at once (score, crate)', () => {
    const r = rig({ god: true });
    const c = r.spawnAt<RingCaravan>('ring-caravan', 300, laneY(3), { gunner: true });
    r.run(80);
    r.world.damage(c, { amount: Math.ceil(c.maxHp / 2) + 1, kind: 'bullet', dirX: 1, owner: 0 });
    r.until(() => c.mode === 'tell-loose', 30);
    const r2 = rig({ god: true });
    const c2 = r2.spawnAt<RingCaravan>('ring-caravan', 300, laneY(3), { gunner: true, drop: 'bombs' });
    r2.run(40);
    const score = r2.session.slots[0].score;
    r2.world.damage(c2, { amount: c2.hp, kind: 'explosion', dirX: 1, owner: 0 });
    expect(c2.dead).toBe(true);
    expect(c2.mode).toBe('tip');
    expect(r2.session.slots[0].score).toBeGreaterThan(score);
    r2.world.flush();
    expect(r2.world.byTag('ring-crate').length).toBe(1);
  });

  it('a wagon in the loose caravan’s way is rammed (2 cells)', () => {
    const r = rig();
    const wg = r.wagon;
    r.until(() => wg.invulnTicks <= 0, 300);
    const c = r.spawnAt<RingCaravan>('ring-caravan', wg.screenX + 46 + 30 + CARAVAN.len / 2, laneY(wg.laneTarget), { gunner: false, looseAfter: 10 });
    r.until(() => c.mode === 'loose' || c.mode === 'tip' || c.mode === 'slide' || wg.cells < wg.maxCells, 400);
    r.until(() => wg.cells < wg.maxCells || c.mode === 'wreck', 300);
    expect(wg.cells).toBe(wg.maxCells - 2);
  });
});

describe('ring gangs: the hostage carriers', () => {
  for (const id of ['ring-parcel-van', 'ring-caravan'] as const) {
    it(`${id}: shots on the grille free the hostage; it leaps onto the roof and drops its gift`, () => {
      const r = rig({ god: false });
      const wg = r.wagon;
      r.until(() => wg.invulnTicks <= 0, 300);
      wg.invulnTicks = 0;
      r.world.damage(wg, RAM);
      const cells = wg.cells;
      const lane = wg.laneTarget >= 3 ? (wg.laneTarget === 3 ? 4 : 3) : 3;
      const carrier = r.spawnAt<RingParcelVan | RingCaravan>(id, 300, laneY(lane), { hostage: true, item: 'repair' });
      r.run(2);
      const h = r.world.byTag('ring-hostage')[0] as RingHostage;
      expect(h).toBeDefined();
      expect(h.carrier).toBe(carrier);
      // The carrier's own hurt slab leaves the grille free.
      const door = { x0: 0, x1: 0 };
      carrier.hostageDoor(door);
      for (const b of carrier.hurtboxes()) expect(b.x >= door.x1 - 0.01 || b.x + b.w <= door.x0 + 0.01).toBe(true);
      const hp = carrier.hp;
      r.world.damage(h, { amount: 60, kind: 'bullet', dirX: 1, owner: 0 });
      expect(h.state).toBe('freed');
      expect(carrier.hp).toBe(hp);
      expect(r.session.slots[0].rescued).toBe(1);
      r.until(() => h.state === 'roof', 120);
      expect(h.ride).toBe(wg);
      r.until(() => h.state === 'leave', 120);
      expect(wg.cells).toBeGreaterThan(cells);
    });
  }

  it('beaten with the hostage still tied, the van frees it; a tipped caravan frees it too', () => {
    const r = rig({ god: true });
    const v = r.spawnAt<RingParcelVan>('ring-parcel-van', 300, laneY(4), { hostage: true });
    r.run(2);
    const h = r.world.byTag('ring-hostage')[0] as RingHostage;
    r.world.damage(v, { amount: v.hp, kind: 'bullet', dirX: 1, owner: 0 });
    expect(h.state).toBe('freed');
    const r2 = rig({ god: true });
    const c = r2.spawnAt<RingCaravan>('ring-caravan', 300, laneY(3), { hostage: true, looseAfter: 20 });
    r2.run(2);
    const h2 = r2.world.byTag('ring-hostage')[0] as RingHostage;
    r2.until(() => c.mode === 'tip', 300);
    expect(h2.state).not.toBe('tied');
  });
});

describe('ring gangs: the gloat and the cower', () => {
  it('every hero out: no attack, the courier sticks a NIET THUIS card; the hero back: they cower', () => {
    const r = rig({ lives: 1 });
    const v = r.spawnAt<RingParcelVan>('ring-parcel-van', 280, laneY(2), { crew: 'thrower' });
    const c = r.spawnAt<RingCaravan>('ring-caravan', 120, laneY(4), { gunner: true });
    r.run(150);
    wreck(r);
    r.run(RING.respawnTicks + 1);
    expect(r.hero.state).toBe('out');
    const attacks: string[] = [];
    let courier: RingCourier | undefined;
    let card: RingCard | undefined;
    for (let i = 0; i < 420; i++) {
      r.run(1);
      for (const e of [v, c]) if (e.mode.startsWith('tell') || e.mode === 'throw' || e.mode === 'shoot' || e.mode === 'brake') attacks.push(`${e.type} ${e.mode}`);
      courier ??= ofType(r, RingCourier)[0];
      card ??= ofType(r, RingCard)[0];
    }
    expect(attacks).toEqual([]);
    expect(v.reaction).toBe('gloat');
    expect(courier).toBeDefined();
    expect(card).toBeDefined();
    expect(c.anim.id).toBe('ring/caravan/gunner/gloat');
    // START: a fresh wagon drives in; on its arrival they cower.
    r.tap(['start']);
    r.until(() => r.hero.state === 'mounted', RING.driveInTicks + 5);
    r.run(2);
    expect(v.reaction).toBe('cower');
    expect(v.anim.id).toBe('ring/parcel-van/crew/cower');
    expect(c.anim.id).toBe('ring/caravan/gunner/cower');
    r.run(200);
    expect(card!.removed).toBe(true);
  });
});

