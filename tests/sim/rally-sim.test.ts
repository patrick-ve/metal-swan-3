/**
 * The headless rally on the real content (src/sim/headless-rally.ts; docs/design/rally.md §14 item
 * 3): the real RallyScene with the bot driving through the race channel; complete, no errors, the
 * three laps in the expected tick range, deterministic, and drawing never changes the state hash.
 */
import { describe, expect, it } from 'vitest';
import { createHeadlessRally, runRally } from '../../src/sim/headless-rally';

/** The gate's range (spec §14 item 3: about 23,000–31,000 ticks with the intro). */
const MIN_TICKS = 23000;
const MAX_TICKS = 31000;

describe('npm run sim -- --mission rally (the headless race with the bot)', () => {
  it.each([
    [1, 'normal'],
    [1, 'easy'],
    [1, 'hard'],
    [2, 'normal'],
    [2, 'hard'],
  ] as const)('%iP %s: complete, 0 errors, three laps, ticks in the gate range', async (players, difficulty) => {
    const r = await runRally({ seed: 1, players, difficulty });
    expect(r.errors).toEqual([]);
    expect(r.complete).toBe(true);
    expect(r.players).toBe(players);
    expect(r.places.every((p) => p >= 1 && p <= 8)).toBe(true);
    for (const laps of r.lapTicks) expect(laps).toHaveLength(3);
    expect(r.ticks).toBeGreaterThanOrEqual(MIN_TICKS);
    expect(r.ticks).toBeLessThanOrEqual(MAX_TICKS);
    expect(r.recoveries!.every((n) => n === 0)).toBe(true);
    expect(r.topKmh!.every((v) => v > 190 && v < 235)).toBe(true);
  });

  it.each([
    [1, 'normal'],
    [1, 'hard'],
    [2, 'normal'],
  ] as const)('the overtaking gate (--grid-back) %iP %s: from the back of the grid through the field, no lock, ticks in range', async (players, difficulty) => {
    const h = await createHeadlessRally({ seed: 1, players, difficulty, gridBack: true });
    try {
      const r = h.runner!;
      // The players start behind every rival.
      for (const c of r.cars) if (c.slot >= 0) expect(c.place).toBeGreaterThan(8 - players);
      h.runUntil((x) => x.done, 40000);
      const rep = h.report();
      expect(rep.errors).toEqual([]);
      expect(rep.complete).toBe(true);
      expect(rep.ticks).toBeGreaterThanOrEqual(MIN_TICKS);
      expect(rep.ticks).toBeLessThanOrEqual(MAX_TICKS);
      // They passed rivals on the way, and no car crawled to the finish locked to another.
      expect(rep.places.some((p) => p <= 8 - players)).toBe(true);
      for (const c of r.cars) if (!c.projected) expect(c.finishTicks).toBeLessThan(MAX_TICKS - 480);
    } finally {
      h.dispose();
    }
  });

  it('the same seed twice → the same report; drawing frames never changes the state hash', async () => {
    const a = await runRally({ seed: 2 });
    const b = await runRally({ seed: 2 });
    const { timing: _a, ...ra } = a;
    const { timing: _b, ...rb } = b;
    expect(ra).toEqual(rb);
    const h = await createHeadlessRally({ seed: 2 });
    try {
      expect(h.input.raceMode).toBe(true);
      for (let i = 0; i < 60000 && !h.done; i++) {
        h.step(1);
        if (i % 97 === 0) h.renderFrame();
      }
      expect(h.done).toBe(true);
      expect(h.report().stateHash).toBe(a.stateHash);
      expect(h.report().ticks).toBe(a.ticks);
    } finally {
      h.dispose();
    }
  });

  it('the bot drives through the race channel (proportional steering) or, with it off, the 8 buttons', async () => {
    const h = await createHeadlessRally({ seed: 1 });
    try {
      const steers = new Set<number>();
      for (let i = 0; i < 3000; i++) {
        h.step(1);
        steers.add(h.input.pad(0).race.steer);
      }
      expect([...steers].filter((s) => s !== 0 && Math.abs(s) !== 127).length).toBeGreaterThan(5);
      expect(h.runner!.carOf(0)!.speed).toBeGreaterThan(30);
    } finally {
      h.dispose();
    }
    const off = await runRally({ seed: 1, raceMode: false });
    expect(off.complete).toBe(true);
    expect(off.errors).toEqual([]);
  });
});
