/**
 * Headless harness + bot: m0 is completed by the bot in god mode on both routes within a tick
 * budget, runs are deterministic per seed, a normal (mortal) run never throws, frames render.
 */
import { describe, expect, it } from 'vitest';
import { comparableReport, createHeadlessGame, type HeadlessOptions, type SimReport } from '../../src/sim/index';

/** m0 should take the bot well under this many ticks (≈ 3.3 minutes of game time). */
const BUDGET = 12_000;

async function run(o: Partial<HeadlessOptions> & { maxTicks?: number }): Promise<SimReport> {
  const game = await createHeadlessGame({ missionId: 'm0', seed: 1, bot: true, ...o });
  try {
    game.runUntil((g) => g.done, o.maxTicks ?? BUDGET);
    return game.report();
  } finally {
    game.dispose();
  }
}

describe('bot on m0', () => {
  it('completes the lower route in god mode within the budget', async () => {
    const r = await run({ god: true, bot: { route: 'lower' } });
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(r.bossDefeated).toBe(true);
    expect(r.sectionsVisited).toEqual(['a', 'b2', 'c']);
    expect(r.ticks).toBeLessThan(BUDGET);
    expect(r.deaths).toBe(0);
    expect(r.kills).toBeGreaterThan(10);
    expect(r.hostages).toBeGreaterThanOrEqual(1);
  });

  it('completes the upper route in god mode (climbs the platforms)', async () => {
    const r = await run({ god: true, bot: { route: 'upper' }, seed: 2 });
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
    expect(r.sectionsVisited).toEqual(['a', 'b1', 'c']);
    expect(r.deaths).toBe(0);
  });

  it('is deterministic: the same seed gives the same report', async () => {
    const a = await run({ god: true, seed: 5 });
    const b = await run({ god: true, seed: 5 });
    expect(comparableReport(b)).toEqual(comparableReport(a));
  });

  it('a mortal run (no god mode) never throws', async () => {
    const r = await run({ god: false, seed: 3, maxTicks: 9000 });
    expect(r.errors).toEqual([]);
    expect(r.ticks).toBeGreaterThan(1000);
  });

  it('starts at the boss with bossRush and beats it', async () => {
    const r = await run({ god: true, bossRush: true, maxTicks: 6000 });
    expect(r.sectionsVisited).toEqual(['c']);
    expect(r.bossDefeated).toBe(true);
    expect(r.missionComplete).toBe(true);
  });

  it('two players (two bots) finish together', async () => {
    const r = await run({ god: true, players: 2, seed: 4 });
    expect(r.errors).toEqual([]);
    expect(r.missionComplete).toBe(true);
  });
});

describe('headless frames', () => {
  it('renders a 384×216 frame with the game in it, and teleports', async () => {
    const game = await createHeadlessGame({ missionId: 'm0', seed: 1, bot: false });
    try {
      game.step(30);
      game.teleport(1300);
      game.step(2);
      expect(Math.round(game.player(0)?.x ?? 0)).toBe(1300);
      const f = game.renderFrame();
      expect(f.w).toBe(384);
      expect(f.h).toBe(216);
      const colours = new Set<number>();
      for (let i = 0; i < f.data.length; i += 97) colours.add(f.data[i]);
      expect(colours.size).toBeGreaterThan(20);
      expect(game.report().errors).toEqual([]);
    } finally {
      game.dispose();
    }
  });

  it('counts missing sounds and songs instead of failing', async () => {
    const game = await createHeadlessGame({ missionId: 'm0', seed: 1, bot: false, loadContent: true });
    try {
      game.audio.sfx('no/such-sound');
      game.audio.music('no-such-song');
      const r = game.report();
      expect(r.missingSfx).toContain('no/such-sound');
      expect(r.missingSongs).toContain('no-such-song');
    } finally {
      game.dispose();
    }
  });
});
