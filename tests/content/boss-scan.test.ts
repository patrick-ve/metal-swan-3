/**
 * The parking scan car (`ams-scan-car`, docs/design/ams-extras.md §3, GDD §10.0b,
 * docs/api/scan-car.md): registration and parts, the intro, telegraphs ≥ 18 ticks (SCAN LOCK, RAM,
 * TOW CALL), phase 2 when the scanner breaks, the wheel clamp's status `clamped`, the lettering,
 * the death (bossDefeated, the drop: a weapon on foot, `pickup-repair` when a player rides) and
 * the 1× / 2× / 4× art. The bot beating it in section c: tests/content/ams-route.test.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { getFrames, hasHiSprite, listSprites } from '../../src/engine/sprites';
import { inPalette } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import { loadContent } from '../../src/game/content/index';
import { AmsScanCar, CLAMPED, isClamped, SCAN, SCAN_ID } from '../../src/game/content/bosses/ams-scan/index';
import { getEntityMeta } from '../../src/game/registry';
import { Vehicle } from '../../src/game/vehicle';
import { TestWorld } from './helpers';

beforeAll(async () => {
  await loadContent();
});

/** A flat test arena (384 wide from x 0), the car coming in from the right, an idle hero at 60. */
function arena(o: { god?: boolean; hpScale?: number; playerX?: number } = {}): { tw: TestWorld; car: AmsScanCar } {
  const tw = new TestWorld({ width: 384, playerX: o.playerX ?? 60, god: o.god ?? true, seed: 4 });
  const car = tw.spawn(SCAN_ID, 424, { facing: -1, arenaLeft: 0, arenaW: 384, hpScale: o.hpScale ?? 1 }) as AmsScanCar;
  return { tw, car };
}

describe('scan car: registration and parts', () => {
  it('is a boss worth 10,000 with the required parts scanner 400 and body 900; its adds are registered', () => {
    expect(getEntityMeta(SCAN_ID)?.category).toBe('boss');
    expect(getEntityMeta(SCAN_ID)?.score).toBe(10000);
    for (const id of ['ams-tow-truck', 'ams-wheel-clamp', 'ams-scan-ticket']) expect(getEntityMeta(id), id).toBeDefined();
    const { car } = arena();
    expect(car.parts.map((p) => [p.name, p.maxHp, p.required])).toEqual([
      ['scanner', SCAN.hp.scanner, true],
      ['body', SCAN.hp.body, true],
    ]);
    expect(CLAMPED.ticks).toBe(45);
  });
});

describe('scan car: the fight', () => {
  it('drives in, brakes at its spot and fights; every telegraph lasts ≥ 18 ticks (SCAN LOCK and RAM)', () => {
    const { tw, car } = arena();
    tw.until(() => car.state === 'fight', 600);
    expect(car.state).toBe('fight');
    expect(Math.abs(car.x - (384 - SCAN.homeIn))).toBeLessThan(8);
    tw.run(2400);
    const kinds = new Set(car.trace.map((t) => t.attack));
    expect(kinds.has('scan')).toBe(true);
    expect(kinds.has('ram')).toBe(true);
    for (const t of car.trace) if (t.fire >= 0) expect(t.fire - t.tell, `${t.attack} at ${t.tell}`).toBeGreaterThanOrEqual(18);
    expect(tw.world.errors).toEqual([]);
  });

  it('phase 2 (the scanner broken): TOW CALL brings the tow truck and its wheel clamps', () => {
    const { tw, car } = arena();
    tw.until(() => car.state === 'fight', 600);
    tw.world.damage(car, { amount: SCAN.hp.scanner * 3, kind: 'explosion', dirX: -1 }, 0);
    expect(car.parts[0].destroyed).toBe(true);
    let truck = false;
    let clamps = 0;
    tw.world.events.on('spawn', (e: { entity?: Entity } | Entity) => {
      const ent = (e as { entity?: Entity }).entity ?? (e as Entity);
      if (ent?.type === 'ams-tow-truck') truck = true;
      if (ent?.type === 'ams-wheel-clamp') clamps++;
    });
    tw.until(() => truck && clamps >= 2, 2400);
    expect(truck).toBe(true);
    expect(clamps).toBeGreaterThanOrEqual(2);
    const tow = car.trace.find((t) => t.attack === 'tow');
    expect(tow).toBeDefined();
    if (tow && tow.fire >= 0) expect(tow.fire - tow.tell).toBeGreaterThanOrEqual(18);
  });

  it('SCAN LOCK: the strip flies over the heads and drops onto the frozen spot (a step away dodges it)', () => {
    const hit = (step: 'left' | 'right' | null): boolean => {
      const { tw, car } = arena({ god: false, playerX: 80 });
      const p = tw.player!;
      tw.until(() => car.reticle?.locked === true, 900);
      if (step) tw.hold(step).run(20).hold();
      tw.until(() => car.trace.some((t) => t.attack === 'scan' && t.fire >= 0), 200);
      // The strip lands about 60 ticks later; the RAM's drive comes much later.
      for (let i = 0; i < 90 && p.state === 'play'; i++) tw.run(1);
      return p.state !== 'play';
    };
    expect(hit(null)).toBe(true);
    expect(hit('left')).toBe(false);
    // A step toward the car passes under the flying strip.
    expect(hit('right')).toBe(false);
  });

  it('the RAM never drives into a clamped hero', () => {
    for (const seed of [1, 2, 3]) {
      const tw = new TestWorld({ width: 384, playerX: 120, god: true, seed });
      const car = tw.spawn(SCAN_ID, 424, { facing: -1, arenaLeft: 0, arenaW: 384 }) as AmsScanCar;
      const p = tw.player!;
      tw.until(() => car.state === 'fight', 600);
      tw.world.damage(car, { amount: SCAN.hp.scanner * 3, kind: 'explosion', dirX: -1 }, 0); // phase 2: clamps
      let wasRam = false;
      let wasOver = false;
      let wasClamped = false;
      let clampedRamStarts = 0;
      let ontoClamped = 0;
      for (let t = 0; t < 3000; t++) {
        tw.hold(Math.floor(t / 90) % 2 ? 'left' : 'right').run(1);
        const ram = car.ramming;
        if (ram && !wasRam && isClamped(p)) clampedRamStarts++;
        const box = ram ? car.contactBoxes()[0] : undefined;
        const r = p.hitRect();
        const over = !!box && box.x < r.x + r.w && r.x < box.x + box.w && box.y < r.y + r.h && r.y < box.y + box.h;
        // The drive's box never moves onto a hero who is already clamped (god mode: a hero the box
        // already covers may still step into a clamp).
        if (over && !wasOver && wasClamped) ontoClamped++;
        wasRam = ram;
        wasOver = over;
        wasClamped = isClamped(p);
      }
      expect(clampedRamStarts, `seed ${seed}`).toBe(0);
      expect(ontoClamped, `seed ${seed}`).toBe(0);
    }
  });

  it('a wheel clamp clamps a hero who steps in: no walking for 45 ticks, then free', () => {
    const tw = new TestWorld({ width: 600, playerX: 100, god: true, seed: 2 });
    const p = tw.player!;
    tw.spawn('ams-wheel-clamp', 130, {});
    tw.hold('right');
    const t = tw.until(() => isClamped(p), 600);
    expect(isClamped(p)).toBe(true);
    const x0 = p.x;
    tw.run(20);
    expect(Math.abs(p.x - x0)).toBeLessThan(1);
    tw.until(() => !isClamped(p), 120);
    expect(isClamped(p)).toBe(false);
    expect(t).toBeGreaterThan(0);
  });
});

describe('scan car: the death', () => {
  function kill(riding: boolean): { tw: TestWorld; car: AmsScanCar; defeated: number } {
    const { tw, car } = arena({ hpScale: 0.05 });
    if (riding) {
      const bike = tw.spawn('beer-bike', 60, { facing: 1 }) as Vehicle;
      tw.run(2);
      bike.mount(tw.player!);
    }
    let defeated = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    tw.until(() => car.state === 'fight', 600);
    for (let i = 0; i < 2; i++) tw.world.damage(car, { amount: 1e4, kind: 'explosion', dirX: -1 }, i);
    tw.until(() => car.defeated, 900);
    return { tw, car, defeated };
  }

  it('the airbag, the flip, the driver runs; bossDefeated once; a weapon drops for a hero on foot', () => {
    const { tw, car, defeated } = kill(false);
    expect(car.defeated).toBe(true);
    expect(defeated).toBe(1);
    expect(car.dropped?.type).toBe('pickup-weapon');
    expect(tw.world.errors).toEqual([]);
  });

  it('a repair crate drops while a player rides a vehicle', () => {
    const { car } = kill(true);
    expect(car.dropped?.type).toBe('pickup-repair');
  });
});

describe('scan car: art', () => {
  it('every boss/ams-scan id has 1× (64-colour) and 2× / 4× (PAL_HD) frames with the 1× geometry', () => {
    const ids = listSprites('boss/ams-scan/');
    expect(ids.length).toBeGreaterThanOrEqual(18);
    for (const id of ids) {
      const lo = getFrames(id, 1);
      for (const f of lo) for (const c of f.buf.data) if ((c & 255) !== 0) expect(inPalette(c), `${id} 1×`).toBe(true);
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id} at ${d}×`).toBe(true);
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}`).toBe(lo.length);
        for (let i = 0; i < hi.length; i++) {
          expect([hi[i].buf.w, hi[i].buf.h], `${id}@${d}[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d]);
          for (const c of hi[i].buf.data) if ((c & 255) !== 0) expect(inHdPalette(c) || inPalette(c), `${id}@${d}`).toBe(true);
        }
      }
    }
  });

  it('the lettering is drawn on the doors and the scanner box (PARKEERCONTROLE, Gemeente Amsterdam, 24)', () => {
    const { tw, car } = arena();
    tw.until(() => car.state === 'fight', 600);
    const drawn: Array<[string, number]> = [];
    const r = { sprite: (id: string, f: number) => drawn.push([id, f]) } as unknown as Parameters<AmsScanCar['draw']>[0];
    car.draw(r);
    const text = drawn.filter(([id]) => id === 'boss/ams-scan/text').map(([, f]) => f);
    expect(text.sort()).toEqual([0, 1, 2]);
  });
});
