/**
 * The oat budget pieces (docs/design/oat.md §6.1, §6.2): the statiegeld bin and its cans, DE
 * HAVERBAR (prices, INFLATIE, GEWEIGERD, the MATCHA-MOMENT, the zuurdesem) and their art.
 */
import { describe, expect, it } from 'vitest';
import { FLOOR, TestWorld } from './helpers';
import type { Damage } from '../../src/engine/entity';
import { getFrames } from '../../src/engine/sprites';
import { inPalette } from '../../src/engine/palette';
import { inOatPalette } from '../../src/engine/palette-hd';
import { gameOf } from '../../src/game/context';
import { isOatContent } from '../../src/game/content/index';
import { OAT_STATUS } from '../../src/game/content/missions/oat/ids';
import {
  buyGood,
  collectDeposit,
  DEPOSIT_CAP,
  DEPOSIT_IDS,
  depositsAlive,
  haverbarPrice,
  MATCHA_CALLOUT,
  OAT_BUDGET_OUTLINED,
  OAT_BUDGET_SPRITES,
  OatBin,
  OatDeposit,
  OatHaverbar,
  SHOP,
  spawnDeposit,
} from '../../src/game/content/oat/budget/index';

const SHOT: Damage = { amount: 10, kind: 'bullet', dirX: 1, owner: 0 };

function euroWorld(o: { seed?: number; playerX?: number | null } = {}): TestWorld {
  const tw = new TestWorld({ seed: o.seed ?? 11, playerX: o.playerX === undefined ? 100 : o.playerX });
  tw.session.setEconomy('euro');
  return tw;
}

function deposits(tw: TestWorld): OatDeposit[] {
  return tw.world.entities.filter((e): e is OatDeposit => e instanceof OatDeposit && !e.removed);
}

/** Shoot a bin dead (three 10-HP shots) and return the pickups it spilled. */
function smash(tw: TestWorld, x: number, params: Record<string, unknown> = {}): OatDeposit[] {
  const bin = tw.spawn('oat-bin', x, params) as OatBin;
  expect(bin).toBeInstanceOf(OatBin);
  for (let i = 0; i < 3; i++) bin.onHit(SHOT);
  tw.world.flush();
  expect(bin.broken).toBe(true);
  expect(bin.hasTag('shootable')).toBe(false);
  return deposits(tw);
}

describe('oat budget pieces: the content id', () => {
  it('the manifest id oat/budget is lazy oat content', () => {
    expect(isOatContent('oat/budget')).toBe(true);
  });
});

describe('oat-bin and its cans (spec §6.1)', () => {
  it('a bin shot dead spills 4-8 pickups, the same for the same seed and place', () => {
    for (const size of [100, 200]) {
      const a = smash(euroWorld({ playerX: null }), 600, { size });
      const b = smash(euroWorld({ playerX: null }), 600, { size });
      expect(a.length).toBeGreaterThanOrEqual(4);
      expect(a.length).toBeLessThanOrEqual(8);
      expect(a.map((e) => [e.kind, e.x, e.vx, e.vy])).toEqual(b.map((e) => [e.kind, e.x, e.vx, e.vy]));
      for (const e of a) expect(DEPOSIT_IDS).toContain(e.kind);
    }
  });

  it('the spill never touches world.rng (spec §7.10)', () => {
    const tw = euroWorld({ playerX: null });
    const before = tw.world.rng.nextU32;
    let calls = 0;
    tw.world.rng.nextU32 = function (this: typeof tw.world.rng) {
      calls++;
      return before.call(this);
    };
    smash(tw, 600);
    expect(calls).toBe(0);
  });

  it('every place gives its own roll, and the counts span the range', () => {
    const counts = new Set<number>();
    for (let x = 400; x < 1400; x += 37) counts.add(smash(euroWorld({ playerX: null }), x).length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...counts)).toBeLessThanOrEqual(8);
    expect(counts.size).toBeGreaterThan(2);
  });

  it('the pickups fly, bounce and settle on the floor', () => {
    // The camera on the bin (a pickup that leaves the view by its despawn margin goes), the player off the spill.
    const tw = euroWorld({ playerX: 480 });
    const list = smash(tw, 600, { size: 200 });
    tw.run(150);
    for (const e of list) {
      expect(e.removed).toBe(false);
      expect(e.body?.onGround).toBe(true);
      expect(e.y).toBeCloseTo(FLOOR, 0);
    }
  });

  it('collecting a can in a euro play books +15 cents in deposit, no points', () => {
    const tw = euroWorld();
    const p = tw.player!;
    const can = spawnDeposit(tw.world, 'oat-can', 300, FLOOR, 0, 0)!;
    tw.world.flush();
    expect(collectDeposit(can, p)).toBe(true);
    const slot = tw.session.slots[0];
    expect(slot.cents).toBe(10_015);
    expect(slot.ledger.tally('deposit').count).toBe(1);
    expect(slot.ledger.tally('deposit').cents).toBe(15);
    expect(slot.score).toBe(0);
    const big = spawnDeposit(tw.world, 'oat-bottle-l', 300, FLOOR, 0, 0)!;
    tw.world.flush();
    collectDeposit(big, p);
    expect(slot.cents).toBe(10_040);
    // The pop-ups merge (spec §6.1: within 30 ticks).
    expect(tw.hud.popups.length).toBe(1);
    expect(tw.hud.popups[0].text).toBe('+€0,40');
  });

  it('a touch collects it; in a point play it pays nothing', () => {
    const tw = euroWorld();
    spawnDeposit(tw.world, 'oat-bottle-s', 100, FLOOR, 0, 0);
    tw.world.flush();
    tw.run(3);
    expect(depositsAlive(tw.world)).toBe(0);
    expect(tw.session.slots[0].cents).toBe(10_015);

    const pt = new TestWorld({ playerX: 100 });
    spawnDeposit(pt.world, 'oat-can', 100, FLOOR, 0, 0);
    pt.world.flush();
    pt.run(3);
    expect(depositsAlive(pt.world)).toBe(0);
    expect(pt.session.slots[0].cents).toBe(10_000);
  });

  it('they blink at 120 and vanish at 720 ticks', () => {
    const tw = euroWorld({ playerX: 100 });
    const can = spawnDeposit(tw.world, 'oat-can', 300, FLOOR, 0, 0)!;
    tw.world.flush();
    tw.run(600);
    expect(can.life).toBeLessThan(121);
    expect(can.removed).toBe(false);
    tw.run(120);
    expect(can.removed).toBe(true);
  });

  it('at most 24 alive: the oldest goes', () => {
    const tw = euroWorld({ playerX: null });
    const all: OatDeposit[] = [];
    for (let i = 0; i < DEPOSIT_CAP + 6; i++) all.push(spawnDeposit(tw.world, 'oat-can', 300 + i * 10, FLOOR, 0, 0)!);
    tw.world.flush();
    expect(depositsAlive(tw.world)).toBe(DEPOSIT_CAP);
    expect(all.slice(0, 6).every((e) => e.removed)).toBe(true);
    expect(all.slice(6).every((e) => !e.removed)).toBe(true);
    expect(deposits(tw).length).toBe(DEPOSIT_CAP);
  });
});

describe('DE HAVERBAR (spec §6.2)', () => {
  /** A shop whose flat white stands where the player is (x 100). */
  function shopWorld(euro = true) {
    const tw = euro ? euroWorld() : new TestWorld({ playerX: 100 });
    const shop = tw.spawn('oat-haverbar', 100 - SHOP.goodDx[0], { greet: false }) as OatHaverbar;
    expect(shop).toBeInstanceOf(OatHaverbar);
    return { tw, shop, p: tw.player!, slot: tw.session.slots[0] };
  }

  /** Stand on the good until the PIN goes through (or `max` ticks); returns the result. */
  function pin(tw: TestWorld, shop: OatHaverbar, max = 40) {
    shop.lastResult = null;
    for (let i = 0; i < max && shop.lastResult === null; i++) tw.run(1);
    return shop.lastResult;
  }

  /** Step off the counter and back on (a new PIN). */
  function stepOff(tw: TestWorld): void {
    tw.player!.placeAt(300, FLOOR, 0);
    tw.run(1);
    tw.player!.placeAt(100, FLOOR, 0);
  }

  it('standing 20 ticks buys a flat white: € 4,45, the status, the kassabon line', () => {
    const { tw, shop, p, slot } = shopWorld();
    tw.run(SHOP.pinTicks - 2);
    expect(shop.lastResult).toBe(null);
    expect(pin(tw, shop)).toBe('bought');
    expect(slot.cents).toBe(10_000 - 445);
    expect(slot.ledger.tally('flatWhite').count).toBe(1);
    expect(p.status.has(OAT_STATUS.flatWhite)).toBe(true);
    expect(p.status.speed).toBeCloseTo(1.2);
    expect(p.status.fireRate).toBeCloseTo(1.3);
    expect(p.status.ticksLeft(OAT_STATUS.flatWhite)).toBeGreaterThan(1150);
    // Standing on: no second buy until the player steps off.
    tw.run(60);
    expect(slot.ledger.tally('flatWhite').count).toBe(1);
  });

  it('INFLATIE: 4,45 → 4,90 → 5,40 for that player', () => {
    const { tw, shop, slot } = shopWorld();
    const paid: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = slot.cents;
      expect(haverbarPrice(slot, 'flatWhite')).toBe([445, 490, 540][i]);
      expect(pin(tw, shop)).toBe('bought');
      paid.push(before - slot.cents);
      stepOff(tw);
    }
    expect(paid).toEqual([445, 490, 540]);
    expect(haverbarPrice(slot, 'matcha')).toBe(520);
    expect(haverbarPrice(slot, 'zuurdesem')).toBe(900);
  });

  it('GEWEIGERD at ≤ € 0 and below the price; it serves again once the budget is above', () => {
    const { tw, shop, p, slot } = shopWorld();
    slot.ledger.book(-10_000, 'other');
    expect(slot.cents).toBe(0);
    expect(pin(tw, shop)).toBe('refused');
    expect(slot.cents).toBe(0);
    expect(p.status.has(OAT_STATUS.flatWhite)).toBe(false);
    stepOff(tw);
    slot.ledger.book(300, 'other');
    expect(pin(tw, shop)).toBe('refused');
    expect(slot.cents).toBe(300);
    stepOff(tw);
    slot.ledger.book(200, 'other');
    expect(pin(tw, shop)).toBe('bought');
    expect(slot.cents).toBe(500 - 445);
  });

  it('MATCHA calls slowWorld (360 ticks) and the MATCHA-MOMENT callout', () => {
    const { tw, p, slot } = shopWorld();
    const runner = {
      slowTicks: 0,
      slowWorld(t: number) {
        this.slowTicks = Math.max(this.slowTicks, t);
      },
    };
    gameOf(tw.world).runner = runner;
    expect(buyGood(tw.world, p, 'matcha', 100, 150)).toBe('bought');
    expect(runner.slowTicks).toBe(360);
    expect(slot.cents).toBe(10_000 - 520);
    expect(tw.hud.callouts.some((c) => c.text === MATCHA_CALLOUT)).toBe(true);
    expect(p.status.has(OAT_STATUS.matcha)).toBe(true);
  });

  it('ZUURDESEM absorbs one hit (KRUIM!), never stacks, has no time limit', () => {
    const { tw, p, slot } = shopWorld();
    expect(buyGood(tw.world, p, 'zuurdesem', 100, 150)).toBe('bought');
    expect(buyGood(tw.world, p, 'zuurdesem', 100, 150)).toBe('have');
    expect(slot.cents).toBe(10_000 - 900);
    tw.run(5000);
    expect(p.status.has(OAT_STATUS.zuurdesem)).toBe(true);
    p.invulnTicks = 0;
    expect(p.onHit({ amount: 1, kind: 'bullet', dirX: 1 })).toBe(true);
    expect(p.state).toBe('play');
    expect(p.status.has(OAT_STATUS.zuurdesem)).toBe(false);
    expect(tw.hud.bubbles.some((b) => b.text === 'KRUIM!')).toBe(true);
    expect(buyGood(tw.world, p, 'zuurdesem', 100, 150)).toBe('bought');
    expect(slot.ledger.tally('zuurdesem').count).toBe(2);
  });

  it('a point play finds the shop closed', () => {
    const { tw, shop, p, slot } = shopWorld(false);
    expect(buyGood(tw.world, p, 'flatWhite', 100, 150)).toBe('closed');
    tw.run(60);
    expect(shop.lastResult).toBe(null);
    expect(slot.cents).toBe(10_000);
    expect(p.status.has(OAT_STATUS.flatWhite)).toBe(false);
  });
});

describe('oat budget art', () => {
  it('every sprite draws at 1, 2 and 4 in its palette, the hittables with an ink outline', () => {
    expect(OAT_BUDGET_SPRITES.length).toBe(10);
    for (const id of OAT_BUDGET_SPRITES) {
      expect(id.startsWith('item/oat/') || id.startsWith('decor/oat/piece/')).toBe(true);
      for (const d of [1, 2, 4]) {
        const frames = getFrames(id, d);
        expect(frames.length).toBeGreaterThan(0);
        for (const f of frames) {
          for (const c of f.buf.data) if (c !== 0) expect(d === 1 ? inPalette(c >>> 0) : inOatPalette(c >>> 0)).toBe(true);
        }
      }
    }
    expect(OAT_BUDGET_OUTLINED.has('decor/oat/piece/bin-100')).toBe(true);
    expect(OAT_BUDGET_OUTLINED.has('item/oat/can')).toBe(true);
    expect(OAT_BUDGET_OUTLINED.has('decor/oat/piece/haverbar')).toBe(false);
  });
});
