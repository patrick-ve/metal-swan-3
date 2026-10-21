/**
 * The enforcement convoy of the ring (docs/design/ring.md §5.3, §9; GDD §4.11 fairness): the scan
 * car (SCAN LOCK), the tow truck (the hook and the tow), the handhaver motorbike (baton, fine
 * sticker) and the sticker on the glass. Registration and art (1× / 2× / 4× with the 1× geometry),
 * a {} spawn that runs 600 ticks in the ring and in a plain world, the telegraphs (≥ 18 ticks, on
 * screen, every attack right after its own tell, tokens), SCAN LOCK that ends with a lane change, a
 * tow hook broken by a swerve and by a cable hit, the sticker (no back aims; a swerve shakes
 * it off), the baton (½ cell), the side ram (bloodless), the gloat (no attack) and the cower.
 */
import { describe, expect, it } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, isDeferredSprite, spriteErrors } from '../../src/engine/sprites';
import { attackTokenLimit } from '../../src/game/enemy';
import { hasEntity } from '../../src/game/registry';
import { SFX } from '../../src/game/content/sfx/index';
import '../../src/game/content/ring/convoy/index';
import '../../src/game/content/ring/hazards/index';
import '../../src/game/content/ring/items/index';
import '../../src/game/content/ring/traffic/index';
import { CONVOY_ART_IDS } from '../../src/game/content/ring/convoy/art';
import { CONVOY_ID, MOTO_ID, SCAN_AI, SCAN_CAR_ID, STICKER_STATUS, TOW_AI, TOW_TRUCK_ID } from '../../src/game/content/ring/convoy/geometry';
import { RingHandhaverMoto, RingSticker } from '../../src/game/content/ring/convoy/moto';
import { RingScanCar, ScanStrip } from '../../src/game/content/ring/convoy/scan-car';
import { RingTowTruck } from '../../src/game/content/ring/convoy/tow-truck';
import { PlaneTumbler } from '../../src/game/content/ring/traffic/road-kit';
import { ringEntityArt } from '../../src/game/ring/art-def';
import { laneY, nearestLane, SHOULDER_TOP } from '../../src/game/ring/lanes';
import { RING_ENTITY_B } from '../../src/game/ring/ids';
import { RingRig } from '../game/ring/ring-helpers';
import { TestWorld, watchFairness, type TestWorld as TW } from './helpers';
import { RecordingRenderer } from '../engine/helpers';

function rig(o: { god?: boolean } = {}): RingRig {
  const r = new RingRig({ god: o.god });
  r.run(2);
  return r;
}

/** The fairness watcher on a ring rig. */
function asTestWorld(r: RingRig): TW {
  return { world: r.world, run: (n = 1) => r.run(n) } as unknown as TW;
}

const sx = (r: RingRig, x: number): number => x - r.world.camera.x;

/** Wait until the wagon can be hit again (the drive-in blink is over). */
function ready(r: RingRig): void {
  r.until(() => r.wagon.invulnTicks <= 0 && !r.wagon.arriving, 400);
}

describe('ring convoy: registration and art', () => {
  it('registers the wave-B ids and their art families', () => {
    for (const id of [RING_ENTITY_B.scanCar, RING_ENTITY_B.towTruck, RING_ENTITY_B.handhaverMoto, CONVOY_ID.sticker]) expect(hasEntity(id), id).toBe(true);
    expect(ringEntityArt(RING_ENTITY_B.scanCar)).toEqual(['ring/scan-car/']);
    expect(ringEntityArt(RING_ENTITY_B.towTruck)).toEqual(['ring/tow-truck/']);
    expect(ringEntityArt(RING_ENTITY_B.handhaverMoto)).toEqual(['ring/handhaver-moto/']);
    for (const s of ['ring/scan-beep', 'ring/scan-lock', 'ring/indicator', 'ring/hook-swing', 'ring/hook-clank', 'ring/winch', 'ring/cable-snap', 'ring/moto-whine', 'ring/baton-draw', 'ring/baton-swing', 'ring/sticker-slap', 'ring/sticker-peel', 'ams/airbag', 'ams/gloat-scribble'])
      expect(SFX[s], s).toBeDefined();
  });

  it('every sprite has 1× frames and 2× / 4× frames with the 1× geometry; the new drawers use PAL_HD only', () => {
    for (const id of CONVOY_ART_IDS) {
      const lo = getFrames(id, 1);
      expect(lo.length, id).toBeGreaterThan(0);
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id} @${d}`).toBe(true);
        const fs = getFrames(id, d);
        expect(fs.length, `${id} @${d}`).toBe(lo.length);
        fs.forEach((f, i) => {
          expect(f.density, `${id}[${i}] @${d}`).toBe(d);
          expect([f.buf.w / d, f.buf.h / d, f.ox, f.oy], `${id}[${i}] @${d}`).toEqual([lo[i].buf.w, lo[i].buf.h, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}[${i}] @${d}`).toEqual(lo[i].pts ?? {});
        });
      }
    }
    // The new art (the ring roof box, the motorbike strips, the sticker): only PAL_HD colours at 4×.
    for (const id of [SCAN_CAR_ID.box, MOTO_ID.ride, MOTO_ID.tellBaton, MOTO_ID.tellSticker, MOTO_ID.fine, TOW_TRUCK_ID.cower]) {
      for (const f of getFrames(id, 4)) for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) expect.fail(`${id}: colour ${c.toString(16)} not in PAL_HD`);
    }
    expect(spriteErrors().filter((e) => CONVOY_ART_IDS.some((id) => e.id === id || e.id.startsWith(`${id}@`)))).toEqual([]);
    for (const id of [MOTO_ID.gloat, MOTO_ID.cower, TOW_TRUCK_ID.cower]) expect(isDeferredSprite(id), id).toBe(true);
    // The tow truck's cower: duck, tremble, peek over the clean body and over the damaged one.
    expect(getFrames(TOW_TRUCK_ID.cower, 1).length).toBe(6);
  });
});

describe('ring convoy: spawn and fairness', () => {
  it('each id runs 600 ticks from {} in the ring and in a plain world without errors', () => {
    const errors: unknown[] = [];
    for (const id of [RING_ENTITY_B.scanCar, RING_ENTITY_B.towTruck, RING_ENTITY_B.handhaverMoto, CONVOY_ID.sticker]) {
      const r = rig({ god: true });
      r.world.events.on('error', (e) => errors.push(e));
      r.spawnAt(id, 280, laneY(2));
      r.spawnAt(id, -60, laneY(4));
      r.run(600);
      const tw = new TestWorld();
      tw.world.events.on('error', (e) => errors.push(e));
      tw.spawn(id, 300);
      tw.run(600);
    }
    expect(errors).toEqual([]);
  });

  it('telegraphs every attack ≥ 18 ticks on screen; tokens hold; no shot from off screen', () => {
    const r = rig({ god: true });
    r.spawnAt('ring-scan-car', 300, laneY(2));
    r.spawnAt('ring-tow-truck', -80, laneY(4));
    r.spawnAt('ring-handhaver-moto', -40, laneY(4), { attack: 'baton' });
    r.spawnAt('ring-handhaver-moto', -100, laneY(2), { attack: 'sticker' });
    const w = watchFairness(asTestWorld(r), 1500, {
      attacks: { scan: 'tell-scan', hook: 'tell-hook', baton: 'tell-baton', sticker: 'tell-sticker' },
      tells: new Set(['tell-scan', 'tell-hook', 'tell-baton', 'tell-sticker']),
      watched: (e) => e instanceof RingScanCar || e instanceof RingTowTruck || e instanceof RingHandhaverMoto,
    });
    const kinds = new Set(w.attacks.map((a) => a.mode));
    expect([...kinds].sort()).toEqual(['baton', 'hook', 'scan', 'sticker']);
    for (const a of w.attacks) {
      expect(a.prev, a.mode).toBe(`tell-${a.mode}`);
      expect(a.tell, a.mode).toBeGreaterThanOrEqual(18);
      expect(a.tellInView, a.mode).toBeGreaterThanOrEqual(18);
      expect(a.inView, a.mode).toBe(true);
    }
    expect(w.outsideShots).toBe(0);
    expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(r.world));
  });
});

describe('ring-scan-car: SCAN LOCK', () => {
  it('a locked wagon drifts back; a lane change ends the lock', () => {
    const r = rig();
    ready(r);
    const wg = r.wagon;
    const lane = nearestLane(wg.y);
    const car = r.spawnAt<RingScanCar>('ring-scan-car', sx(r, wg.x) + 110, laneY(lane - 1));
    r.until(() => car.mode === 'tell-scan', 300);
    const strip = car.strip as ScanStrip;
    expect(strip).toBeInstanceOf(ScanStrip);
    expect(strip.lane).toBe(lane);
    expect(strip.ticksToLock).toBeGreaterThanOrEqual(18);
    r.until(() => car.mode === 'scan', 120);
    expect(strip.state).toBe('lock');
    const x0 = sx(r, wg.x);
    r.run(40);
    expect(strip.holds(wg)).toBe(true);
    expect(sx(r, wg.x)).toBeLessThan(x0 - 20);
    // Change lanes (away from the car): the lock ends, the wagon is free.
    r.tap(['down']);
    r.until(() => strip.state === 'fade' || strip.removed, SCAN_AI.grace + 40);
    r.until(() => car.mode === 'recover' || car.mode === 'ride', 30);
    const x1 = sx(r, wg.x);
    r.hold(['right']).run(30).release();
    expect(sx(r, wg.x)).toBeGreaterThan(x1 + 20);
  });

  it('breaks down with the airbag (no score twice) and drops a crate; the strip goes with it', () => {
    const r = rig();
    const car = r.spawnAt<RingScanCar>('ring-scan-car', 260, laneY(2));
    r.run(5);
    const score = r.session.slots[0].score;
    r.world.damage(car, { amount: 9999, kind: 'bullet', dirX: 1, owner: 0 });
    expect(car.dead).toBe(true);
    expect(r.session.slots[0].score).toBe(score + SCAN_AI.score);
    r.world.flush();
    expect(r.world.byTag('ring-crate').length).toBe(1);
    expect(car.hurtboxes().length).toBe(0);
    const y0 = car.y;
    r.run(120);
    expect(car.y).toBeGreaterThan(y0);
    r.until(() => car.removed, 600);
  });
});

describe('ring-tow-truck: the hook and the tow', () => {
  /** A truck right ahead of the wagon in its lane, until it has the wagon on the hook. */
  function hooked(r: RingRig): RingTowTruck {
    ready(r);
    const wg = r.wagon;
    const t = r.spawnAt<RingTowTruck>('ring-tow-truck', sx(r, wg.x) + 46 + TOW_AI.holdGap + 48, wg.y);
    r.until(() => t.hooked === wg, 400);
    return t;
  }

  it('a hooked wagon is dragged back and cannot change lanes; a swerve breaks it free', () => {
    const r = rig();
    const t = hooked(r);
    const wg = r.wagon;
    const lane = nearestLane(wg.y);
    const x0 = sx(r, wg.x);
    r.tap(['down']);
    r.run(30);
    expect(nearestLane(wg.y)).toBe(lane);
    expect(sx(r, wg.x)).toBeLessThan(x0 - 10);
    expect(t.cable?.hasTag('shootable')).toBe(true);
    r.tap(['jump', 'up']);
    r.run(8);
    expect(t.hooked).toBe(null);
    expect(t.cable?.hasTag('shootable')).toBe(false);
    expect(nearestLane(wg.y)).not.toBe(lane);
  });

  it('a hit on the cable snaps it; the hero’s forward shots hit the cable first', () => {
    const r = rig();
    const t = hooked(r);
    const cable = t.cable!;
    expect(cable.hurtboxes().length).toBe(1);
    // Enemy-team hits do nothing; player hits count.
    expect(r.world.damage(cable, { amount: 99, kind: 'bullet', dirX: 1 })).toBe(false);
    expect(t.hooked).not.toBe(null);
    const hp = t.hp;
    r.hold(['fire']);
    r.until(() => t.hooked === null, 120);
    r.release();
    expect(t.hp).toBe(hp);
  });

  it('pinned at the left of the band, the winch hauls: a cell per haul', () => {
    const r = rig();
    const t = hooked(r);
    const wg = r.wagon;
    const cells = wg.cells;
    r.until(() => sx(r, wg.x) <= 71, 200);
    r.run(TOW_AI.haul + 2);
    expect(wg.cells).toBeLessThan(cells);
    expect(t.hooked).toBe(wg);
  });
});

describe('ring-handhaver-moto: baton and sticker', () => {
  it('the baton costs ½ cell at the window', () => {
    const r = rig();
    ready(r);
    const wg = r.wagon;
    const m = r.spawnAt<RingHandhaverMoto>('ring-handhaver-moto', -40, laneY(4), { attack: 'baton' });
    const cells = wg.cells;
    r.until(() => m.mode === 'baton', 400);
    r.run(1);
    expect(wg.cells).toBe(cells - 0.5);
  });

  it('the sticker blocks the back aims until a swerve shakes it off', () => {
    const r = rig({ god: true });
    ready(r);
    const hero = r.hero;
    /** Hold FIRE and the direction for a moment: the aim it ends on. */
    const aimWith = (keys: string[]): string => {
      r.hold(['fire', ...keys] as never).run(4).release().run(2);
      return hero.aim8;
    };
    expect(aimWith(['left'])).toBe('back');
    aimWith(['right']);
    const m = r.spawnAt<RingHandhaverMoto>('ring-handhaver-moto', -40, laneY(4), { attack: 'sticker' });
    r.until(() => hero.status.has(STICKER_STATUS), 400);
    expect(r.world.byTag('ring-sticker').length).toBe(1);
    m.remove();
    // No back aim while it sticks; the forward and straight aims still work, and so does fire.
    expect(aimWith(['left'])).toBe('forward');
    expect(aimWith(['left', 'up'])).toBe('forward');
    expect(aimWith(['up'])).toBe('far');
    expect(aimWith(['left', 'down'])).toBe('far');
    expect(aimWith(['right', 'down'])).toBe('forward-near');
    const s0 = r.session.slots[0].stats.shots;
    r.hold(['fire']).run(60).release().run(2);
    expect(r.session.slots[0].stats.shots).toBeGreaterThan(s0);
    r.tap(['jump']);
    r.run(2);
    expect(hero.status.has(STICKER_STATUS)).toBe(false);
    r.world.flush();
    expect(r.world.byTag('ring-sticker').length).toBe(0);
    expect(r.world.entities.some((e) => e instanceof PlaneTumbler)).toBe(true);
    expect(aimWith(['left', 'down'])).toBe('back-near');
  });

  it('a second slap refreshes the one sticker; a wreck takes it along', () => {
    const r = rig();
    ready(r);
    const wg = r.wagon;
    const s = new RingSticker(r.world, wg.x, wg.y, { wagon: wg });
    r.world.add(s);
    r.run(30);
    const left = r.hero.status.ticksLeft(STICKER_STATUS);
    s.refresh();
    expect(r.hero.status.ticksLeft(STICKER_STATUS)).toBeGreaterThan(left);
    expect(RingSticker.on(r.world, wg)).toBe(s);
    wg.wreck();
    r.run(2);
    expect(s.removed).toBe(true);
  });

  it('the side ram knocks the rider onto the hard shoulder (bloodless)', () => {
    const r = rig();
    const m = r.spawnAt<RingHandhaverMoto>('ring-handhaver-moto', 260, laneY(2));
    r.run(2);
    r.world.damage(m, { amount: 120, kind: 'impact', dirX: 1, owner: 0, tags: ['ram', 'side-ram'] });
    expect(m.dead).toBe(true);
    r.world.flush();
    expect(r.world.entities.filter((e) => e instanceof PlaneTumbler).length).toBe(2);
    r.run(70);
    expect(r.world.entities.some((e) => e instanceof PlaneTumbler && e.y > SHOULDER_TOP)).toBe(true);
  });
});

describe('ring convoy: the gloat and the cower', () => {
  it('gloats without attacking (the moto writes a fine, the truck lowers its hook), then cowers', () => {
    const r = rig();
    const spot = r.hero;
    const m = r.spawnAt<RingHandhaverMoto>('ring-handhaver-moto', 200, laneY(2));
    const t = r.spawnAt<RingTowTruck>('ring-tow-truck', 300, laneY(1));
    const c = r.spawnAt<RingScanCar>('ring-scan-car', 300, laneY(3));
    r.run(5);
    for (const e of [m, t, c]) expect(e.react('gloat', 300, spot)).toBe(true);
    const tells: string[] = [];
    for (let i = 0; i < 200; i++) {
      r.run(1);
      for (const e of [m, t, c]) if (e.mode.startsWith('tell')) tells.push(e.mode);
    }
    expect(tells).toEqual([]);
    expect(m.anim.id).toBe(MOTO_ID.gloat);
    expect(Math.abs(t.hookY - (spot.y - 4))).toBeLessThan(8);
    for (const e of [m, t, c]) expect(e.react('cower', 60, spot)).toBe(true);
    r.run(2);
    expect(m.anim.id).toBe(MOTO_ID.cower);
    // The tow truck's driver ducks below the sill (its cower overlay over the body), only then.
    const cowerDraws = (): number => {
      const rr = new RecordingRenderer();
      t.draw(rr);
      return rr.calls.filter((k) => k.op === 'sprite' && k.args[0] === TOW_TRUCK_ID.cower).length;
    };
    expect(cowerDraws()).toBe(1);
    r.run(70);
    expect(t.reaction).toBe(null);
    expect(cowerDraws()).toBe(0);
  });
});
