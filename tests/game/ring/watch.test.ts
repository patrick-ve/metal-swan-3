/**
 * The ring watch on real runs (docs/design/ring.md §15; GDD §1.5 pacing, §4.11 fairness;
 * src/sim/headless-ring.ts `RingWatchReport`): the ring bot drives whole rings on normal, 1P and
 * 2P (revision R: the whole level, the drive measured by the watch, the foot part by the 2D bot),
 * and the measured numbers stay inside the limits. A 2P bot clears waves faster, so its gaps
 * run a little longer than 1P's (the plan never depends on the player count). 1P: 270 ticks, 30
 * over the 4 s rule. 2P: 300 ticks since the user's play-test 2026-10-21 (fewer enemies: smaller
 * gangs, fewer waves; measured seeds 1–3: 1P ≤ 260, 2P ≤ 295).
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../../src/game/content/index';
import { runRing } from '../../../src/sim/headless-ring';

await loadContent();

/**
 * Revision R: the whole level (the short drive, the ZWAAN train, the hand-over, rf-a, rf-b) in
 * ticks at the bot's pace: the spec's gate is 28,800–36,000 (§R.12). While `rf-b` is wave A's
 * placeholder (about 850 ticks) the test checks the PROJECTED total: the run with rf-b's own ticks
 * replaced by wave B's planned ~9,000 (§R.1). Wave A (integrator, 2026-10-22, normal, the bots):
 * the measured god totals 23,700–25,800 → projected about 31,900–33,900. Wave B: set
 * `RF_B_PLACEHOLDER` false.
 */
const LEVEL_TICKS: readonly [number, number] = [28_800, 36_000];
const RF_B_PLACEHOLDER = true;
const RF_B_PLANNED = 9_000;

/** The level's ticks at the bot's pace (projected while rf-b is the placeholder, see above). */
function levelTicks(r: Awaited<ReturnType<typeof runRing>>): number {
  if (!RF_B_PLACEHOLDER) return r.ticks;
  return r.ticks - (r.foot?.sectionTicks['rf-b'] ?? 0) + RF_B_PLANNED;
}

/** Longest stretch without an enemy on screen (ticks) a bot run may show (1P, 2P). */
const GAP_LIMIT: Record<1 | 2, number> = { 1: 270, 2: 300 };

describe('ring watch (bot runs, normal)', () => {
  for (const players of [1, 2] as const) {
    for (const seed of [1, 2, 3]) {
      it(`seed ${seed}, ${players}P: complete; pacing gaps, off-screen attacks, tells and open lanes inside the limits`, async () => {
        const r = await runRing({ seed, players, bot: true, loadContent: false });
        expect(r.errors).toEqual([]);
        expect(r.complete).toBe(true);
        expect(r.foot?.complete).toBe(true);
        expect(r.bossDefeated).toBe(true);
        expect(levelTicks(r)).toBeGreaterThanOrEqual(LEVEL_TICKS[0]);
        expect(levelTicks(r)).toBeLessThanOrEqual(LEVEL_TICKS[1]);
        const w = r.watch;
        expect(w.longestGap, JSON.stringify(w.gaps)).toBeLessThanOrEqual(GAP_LIMIT[players]);
        // The momentum on foot: rf-a never runs empty for long (its trickle guard: 150 ticks).
        expect(r.foot?.sectionGaps['rf-a'] ?? Infinity).toBeLessThanOrEqual(GAP_LIMIT[players]);
        // The train: every catch-up ≤ 3 s (§R.13).
        for (const c of r.train?.catchUps ?? []) expect(c).toBeLessThanOrEqual(180);
        expect(w.outsideShots).toBe(0);
        expect(w.offscreenHits).toBe(0);
        expect(w.minTell).toBeGreaterThanOrEqual(18);
        expect(w.minOpenLanes).toBeGreaterThanOrEqual(1);
        expect(r.maxEntities).toBeLessThanOrEqual(120);
      });
    }
  }
});

/**
 * The 4-second rule on the short drive (fixer, 2026-10-22; GDD §1.5, spec §R.2): god runs on the
 * seeds where the review measured gaps over 240 ticks (1P seeds 6 and 8, 2P seed 2). With the short
 * route's forced-wave mark at 80 ticks the longest is 164–218 (god seeds 1–10, 2P 1–3).
 */
describe('ring watch: the 4-second rule on the short drive (god)', () => {
  for (const [seed, players] of [[6, 1], [8, 1], [2, 2]] as const) {
    it(`seed ${seed}, ${players}P: no stretch over 240 ticks without an enemy`, async () => {
      const r = await runRing({ seed, players, god: true, bot: true, loadContent: false });
      expect(r.complete).toBe(true);
      expect(r.watch.longestGap, JSON.stringify(r.watch.gaps)).toBeLessThanOrEqual(240);
    });
  }
});
