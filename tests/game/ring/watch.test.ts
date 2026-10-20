/**
 * The ring watch on real runs (docs/design/ring.md §15; GDD §1.5 pacing, §4.11 fairness;
 * src/sim/headless-ring.ts `RingWatchReport`): the ring bot drives whole rings on normal, 1P and
 * 2P, and the measured numbers stay inside the limits. A 2P bot clears waves faster, so its gaps
 * run a little longer than 1P's (the plan never depends on the player count): the limit is 270
 * ticks, 30 over the 4 s rule (measured 2026-10-21, seeds 1–6: 1P ≤ 243, 2P ≤ 254).
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../../src/game/content/index';
import { runRing } from '../../../src/sim/headless-ring';

await loadContent();

/** Longest stretch without an enemy on screen (ticks) a bot run may show. */
const GAP_LIMIT = 270;

describe('ring watch (bot runs, normal)', () => {
  for (const players of [1, 2] as const) {
    for (const seed of [1, 2, 3]) {
      it(`seed ${seed}, ${players}P: complete; pacing gaps, off-screen attacks, tells and open lanes inside the limits`, async () => {
        const r = await runRing({ seed, players, bot: true, loadContent: false });
        expect(r.errors).toEqual([]);
        expect(r.complete).toBe(true);
        expect(r.ticks).toBeGreaterThanOrEqual(28800);
        expect(r.ticks).toBeLessThanOrEqual(39600);
        const w = r.watch;
        expect(w.longestGap, JSON.stringify(w.gaps)).toBeLessThanOrEqual(GAP_LIMIT);
        expect(w.outsideShots).toBe(0);
        expect(w.offscreenHits).toBe(0);
        expect(w.minTell).toBeGreaterThanOrEqual(18);
        expect(w.minOpenLanes).toBeGreaterThanOrEqual(1);
        expect(r.maxEntities).toBeLessThanOrEqual(120);
      });
    }
  }
});
