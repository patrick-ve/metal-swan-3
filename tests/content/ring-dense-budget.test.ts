/**
 * Mission ring — the tier-4 working set stays inside the budget (docs/design/ring.md §11, §15;
 * gameplay.ts `denseWorkingSet`, `DENSE_BUDGET_BYTES` = 256 MB): for seeds 1-20, every squad hero
 * alone (1P, with its driver) and hero pairs (2P, with two drivers), in every stretch of the plan
 * (the next stretch counts as ahead), the 4× bytes of the sprite set fit the budget minus a 2 MB
 * margin minus the streamed scenery's own reserve (`RING_SCENERY_RESERVE`, ring/view.ts; the
 * ring's `denseReserve`, which the tier-4 run keeps out of the sprite budget at run time).
 *
 * The method of ams-dense-budget.test.ts: the bytes come from the 1× frames (a 4× frame has its
 * 1× frame's logical size: 16 × the pixels, 4 bytes each), so no 4× art is built here.
 *
 * Revision R: the level's plan (the short route) has, after `zuid`, the ZWAAN train's pseudo-sections
 * (`zwaan:<i>`, one part and the next at a time) and the on-foot sections (`rf-a`, `rf-b`) with
 * their own reserve (`sectionReserve`): each section is held to the budget minus its own reserve.
 * The full route (tests and sims) keeps its check on fewer seeds.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getFrames } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { RF_SCENERY_RESERVE } from '../../src/game/content/ring/foot/index';
import { ringArtDef } from '../../src/game/ring/art-def';
import { planRing } from '../../src/game/ring/plan';
import type { RingPlan } from '../../src/game/ring/types';
import { RING_SCENERY_RESERVE } from '../../src/game/ring/view';
import { ROSTER } from '../../src/game/scenes/flow-data';
import { DENSE_BUDGET_BYTES, denseWorkingSet, nextSections } from '../../src/game/scenes/gameplay';
import { expectedDrivers } from '../../src/game/scenes/ring-route';
import { GameSession } from '../../src/game/session';

beforeAll(async () => {
  await loadContent();
}, 120_000);

const MARGIN = 2 * 1024 * 1024;
const LIMIT = DENSE_BUDGET_BYTES - MARGIN - RING_SCENERY_RESERVE;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const FULL = { route: 'full' } as const;
/** The plans of a seed checked here: the level (short) for every seed, the full loop for seeds 1-5. */
function plansOf(seed: number): RingPlan[] {
  return seed <= 5 ? [planRing(seed), planRing(seed, 'normal', FULL)] : [planRing(seed)];
}

/** 4× bytes per id from its 1× frames (shared buffers once per id), memoised. */
const idBytes = new Map<string, number>();
function bytes(ids: readonly string[]): number {
  let b = 0;
  for (const id of ids) {
    let n = idBytes.get(id);
    if (n === undefined) {
      n = 0;
      const seen = new Set<unknown>();
      for (const f of getFrames(id, 1)) {
        if (seen.has(f.buf)) continue;
        seen.add(f.buf);
        n += f.buf.w * f.buf.h * 64;
      }
      idBytes.set(id, n);
    }
    b += n;
  }
  return b;
}

/**
 * The working set of a plan for these heroes with the least room left (every section), with its
 * section and its limit (the budget minus the margin minus the section's own reserve).
 */
function peak(plan: RingPlan, heroes: readonly string[]): { bytes: number; limit: number; stretch: string; drivers: string } {
  const session = new GameSession({ characters: [...heroes] });
  const drivers = expectedDrivers(plan, session);
  const def = ringArtDef(plan, drivers);
  const order = Object.keys(def.sections ?? {});
  let best = { bytes: 0, limit: LIMIT, stretch: '', drivers: drivers.filter(Boolean).join('+') };
  let room = Infinity;
  for (let i = 0; i < order.length; i++) {
    const set = denseWorkingSet(def, heroes.map((h) => `char/${h}/`), order[i], nextSections(def, order, order[i], i), heroes.length);
    const b = bytes(set);
    const limit = DENSE_BUDGET_BYTES - MARGIN - (def.sectionReserve?.[order[i]] ?? def.denseReserve);
    if (limit - b < room) {
      room = limit - b;
      best = { ...best, bytes: b, limit, stretch: order[i] };
    }
  }
  return best;
}

const mb = (b: number): string => `${(b / 1048576).toFixed(1)} MB`;

describe('ring tier-4 working set', () => {
  it('the ring keeps the scenery reserve out of the sprite budget (denseReserve)', () => {
    expect(ringArtDef(planRing(1), ['thom', null]).denseReserve).toBe(RING_SCENERY_RESERVE);
    expect(LIMIT).toBeGreaterThan(200 * 1048576);
  });

  it('revision R: one run for the level — the stretches, the train per part, then the foot sections with their own reserve', () => {
    const plan = planRing(1);
    const def = ringArtDef(plan, ['thom', null]);
    expect(Object.keys(def.sections ?? {})).toEqual(['oost', 'amstel', 'zuid', 'zwaan:0', 'zwaan:1', 'zwaan:2', 'zwaan:3', 'zwaan:4', 'rf-a', 'rf-b']);
    expect(def.sectionReserve?.zuid).toBe(RING_SCENERY_RESERVE);
    expect(def.sectionReserve?.['rf-a']).toBe(RF_SCENERY_RESERVE);
    expect(def.sectionReserve?.['rf-b']).toBe(RF_SCENERY_RESERVE);
    // The train's parts never sit in preloadLast (never all five at once).
    for (const p of def.preloadLast ?? []) expect(p.startsWith('boss/ring-zwaan/'), p).toBe(false);
  });

  it('wave B: each stretch holds the families of the wave-B enemies it uses; the lorry is the boss art of westpoort', () => {
    const fam: Record<string, string> = {
      'ring-parcel-van': 'ring/parcel-van/',
      'ring-caravan': 'ring/caravan/',
      'ring-scan-car': 'ring/scan-car/',
      'ring-tow-truck': 'ring/tow-truck/',
      'ring-handhaver-moto': 'ring/handhaver-moto/',
      'ring-roadworks': 'ring/roadworks/',
    };
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = planRing(seed, 'normal', FULL);
      const def = ringArtDef(plan, ['thom', null]);
      for (const sp of plan.spawns) {
        const want = fam[sp.id] ?? (sp.id === 'ring-jam' ? 'ring/boarder/' : undefined);
        if (!want) continue;
        const st = plan.stretches.find((x) => sp.at >= x.start && sp.at < x.end)!;
        expect(def.sections?.[st.id]?.art, `seed ${seed} ${sp.id} in ${st.id}`).toContain(want);
        seen.add(want);
      }
      // Revision R: the westpoort slot is the ZWAAN train (an art-less controller): its parts' art
      // is in the pseudo-sections `zwaan:0..4`, never in `preloadLast`.
      expect(def.sections?.['zwaan:0']?.art).toContain('boss/ring-zwaan/container/');
      expect(def.preloadLast?.some((p) => p.startsWith('boss/ring-zwaan/'))).toBe(false);
    }
    expect(seen.size).toBe(7);
  });

  it('1P: every squad hero (and its driver) in every stretch of seeds 1-20 fits the budget minus the scenery reserve', () => {
    const over: string[] = [];
    let top = 0;
    for (const seed of SEEDS) {
      for (const plan of plansOf(seed)) {
        for (const hero of ROSTER) {
          const p = peak(plan, [hero]);
          top = Math.max(top, p.bytes);
          if (p.bytes > p.limit) over.push(`seed ${seed} ${plan.route} ${hero} (driver ${p.drivers}) ${p.stretch} ${mb(p.bytes)} > ${mb(p.limit)}`);
        }
      }
    }
    expect(over).toEqual([]);
    expect(top).toBeGreaterThan(0);
  }, 120_000);

  it('2P: hero pairs (and two drivers) in every stretch of seeds 1-20 fit the budget minus the scenery reserve', () => {
    const over: string[] = [];
    for (const seed of SEEDS) {
      for (const plan of plansOf(seed)) {
        for (let i = 0; i < ROSTER.length; i++) {
          const pair = [ROSTER[i], ROSTER[(i + 1) % ROSTER.length]];
          const p = peak(plan, pair);
          expect(p.drivers.split('+').length, `seed ${seed} ${pair.join('+')}: two drivers`).toBe(2);
          if (p.bytes > p.limit) over.push(`seed ${seed} ${plan.route} ${pair.join('+')} (drivers ${p.drivers}) ${p.stretch} ${mb(p.bytes)} > ${mb(p.limit)}`);
        }
      }
    }
    expect(over).toEqual([]);
  }, 120_000);
});
