/**
 * The rally bot (src/sim/bot-rally.ts; docs/design/rally.md §14 item 3): it drives a player slot
 * along the line through the race channel (analog steer, gas and brake) at a decent pace and
 * completes the race in 1P and 2P at every difficulty; with the race mode off it presses the 8
 * buttons and still completes.
 */
import { describe, expect, it } from 'vitest';
import { RallyBot } from '../../../src/sim/bot-rally';
import { race, ringTrack } from './helpers';

const RING = ringTrack();

function runBot(o: { players: 1 | 2; difficulty: 'easy' | 'normal' | 'hard'; raceMode?: boolean }) {
  const h = race({ track: RING, ...o });
  const bot = new RallyBot(() => h.runner);
  h.input.addSource(bot);
  const steers = new Set<number>();
  let ticks = 0;
  for (; ticks < 40000 && !h.runner.done; ticks++) {
    h.step();
    if (h.runner.phase === 'race') steers.add(h.input.pad(0).race.steer);
  }
  return { h, ticks, steers };
}

describe('the bot completes the race', () => {
  it.each([
    [1, 'easy'],
    [1, 'normal'],
    [1, 'hard'],
    [2, 'easy'],
    [2, 'normal'],
    [2, 'hard'],
  ] as const)('%iP %s: three laps, every player placed, no stuck car', (players, difficulty) => {
    const { h, ticks } = runBot({ players, difficulty });
    expect(h.runner.done).toBe(true);
    const rep = h.runner.report();
    expect(rep.complete).toBe(true);
    expect(rep.places).toHaveLength(players);
    expect(rep.places.every((p) => p >= 1 && p <= 8)).toBe(true);
    expect(new Set(rep.places).size).toBe(players);
    for (const laps of rep.lapTicks) expect(laps).toHaveLength(3);
    // A 6.7 km loop: three laps in about 6–8 minutes.
    expect(ticks).toBeGreaterThan(20000);
    expect(ticks).toBeLessThan(31000);
    for (const c of h.runner.cars) expect(c.phys.recoveries).toBe(0);
    // A decent human pace: within 4 % of the fastest rival's best lap... or faster.
    const best = Math.min(...rep.bestLap!);
    const rivals = h.runner.cars.filter((c) => c.slot < 0 && c.lapTicks.length > 1).map((c) => Math.min(...c.lapTicks.slice(1)));
    if (rivals.length > 0) expect(best).toBeLessThan(Math.min(...rivals) * 1.04);
  });

  it('it steers through the race channel (proportional values, not only full lock)', () => {
    const { steers } = runBot({ players: 1, difficulty: 'normal' });
    const partial = [...steers].filter((s) => s !== 0 && Math.abs(s) !== 127);
    expect(partial.length).toBeGreaterThan(10);
  });

  it('with the race mode off it presses the 8 buttons and still completes', () => {
    const { h } = runBot({ players: 1, difficulty: 'normal', raceMode: false });
    expect(h.runner.done).toBe(true);
    expect(h.car().lapTicks).toHaveLength(3);
    expect(h.input.pad(0).raceOn).toBe(false);
  });
});
