/**
 * Revision R (docs/design/ring.md §R.1, §R.2): the short route — the level's plan — and the URLs.
 * The drive is `oost` → `amstel` → `zuid` (about 7,200 ticks of road ± 5 % before the boss chunk),
 * no mid-drive jam, one gantry closure and one speed camera, the golden record in amstel or zuid,
 * ≥ 1 hostage per stretch, the ZWAAN truck's slot in zuid's boss chunk, then the final jam (the last
 * chunk). The full loop still plans (plan.test.ts pins it). `?section=` / `--section`: a landmark of
 * the short route, `zwaan` (a run-in to the truck), `rf-a` / `rf-b` (on foot); an unused landmark
 * implies the full route.
 */
import { describe, expect, it } from 'vitest';
import { planTicksAt, RING_PLAN } from '../../../src/game/ring/director';
import { RING_ROUTES, RING_ZWAAN } from '../../../src/game/ring/ids';
import { formatKm, ringKmAt, SHORT_BOSS_CHUNK, ZWAAN_SLOT_OFFSET } from '../../../src/game/ring/landmarks';
import { checkPlan, chunkAt, planRing } from '../../../src/game/ring/plan';
import { ringStartDist } from '../../../src/game/ring/runner';
import { RING } from '../../../src/game/ring/types';
import { isFootSection, ringRouteFor, startStretch } from '../../../src/game/scenes/ring-route';
import type { Difficulty } from '../../../src/game/session';
import { parseLaunchParams } from '../../../src/game/params';
import { ringRouteParam } from '../../../src/game/scenes/boot';

const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

describe('the short route (the level)', () => {
  it('is the default; 50 seeds × 3 difficulties: checkPlan finds nothing', () => {
    expect(planRing(1).route).toBe('short');
    const problems: string[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      for (const d of DIFFS) for (const p of checkPlan(planRing(seed * 7919, d))) problems.push(`${seed}/${d}: ${p}`);
    }
    expect(problems).toEqual([]);
  });

  it('oost → amstel → zuid; 2:00 of road ± 5 % before the boss chunk; the final jam last', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = planRing(seed);
      expect(p.landmarks.map((l) => l.id)).toEqual([...RING_ROUTES.short]);
      const boss = p.chunks.find((c) => c.tail && c.part === 'boss')!;
      expect(boss.stretch).toBe('zuid');
      expect(boss.length).toBe(SHORT_BOSS_CHUNK);
      const road = planTicksAt(p.chunks, boss.start);
      expect(Math.abs(road - RING_PLAN.short.ticks)).toBeLessThanOrEqual(RING_PLAN.short.ticks * RING_PLAN.tolerance);
      const last = p.chunks[p.chunks.length - 1];
      expect([last.type, last.part, last.scene, last.tail]).toEqual(['jam', 'final-jam', true, true]);
      // The boarding first (the S113 on-ramp scene).
      expect(p.chunks[0].part).toBe('boarding');
    }
  });

  it('no mid-drive jam; one gantry closure and one speed camera; the final jam controller never clears early', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = planRing(seed);
      expect(p.chunks.filter((c) => c.type === 'jam' && c.part !== 'final-jam')).toEqual([]);
      expect(p.chunks.filter((c) => c.type === 'gantry' && c.part === 'closure')).toHaveLength(1);
      expect(p.chunks.filter((c) => c.type === 'speedcam')).toHaveLength(1);
      const jams = p.spawns.filter((s) => s.id === 'ring-jam');
      expect(jams).toHaveLength(1);
      expect(jams[0].params).toMatchObject({ final: true, hold: 0 });
      expect(jams[0].params?.waves).toBeUndefined();
    }
  });

  it('the ZWAAN slot in zuid’s boss chunk; the golden record in amstel or zuid; ≥ 1 hostage per stretch', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = planRing(seed);
      expect(p.bosses).toHaveLength(1);
      const b = p.bosses[0];
      expect([b.id, b.landmark, b.lane]).toEqual([RING_ZWAAN.controller, 'zuid', 1]);
      const c = chunkAt(p, b.at)!;
      expect(c.part).toBe('boss');
      expect(b.at - c.start).toBe(ZWAAN_SLOT_OFFSET);
      const golden = p.stretches.find((s) => p.goldenRecord >= s.start && p.goldenRecord < s.end)!;
      expect(['amstel', 'zuid']).toContain(golden.id);
      for (const st of p.stretches) expect(p.hostages[st.id], st.id).toBeGreaterThanOrEqual(1);
      // No plan wave, hostage or item in the tail (the truck brings its own adds).
      for (const s of p.spawns) {
        const at = chunkAt(p, s.at);
        if (s.id === 'ring-jam') continue;
        if (at?.tail) expect(['ring-car'], `${s.id} at ${s.at}`).toContain(s.id);
      }
    }
  });

  it('the hectometre posts run from about 13 to about 20 (the short route ends before De Nieuwe Meer)', () => {
    const p = planRing(3);
    expect(formatKm(ringKmAt(p, 0))).toBe('13,0');
    const end = ringKmAt(p, p.length - 1);
    expect(end).toBeGreaterThan(17.5);
    expect(end).toBeLessThanOrEqual(20.4);
  });

  it('the full route still plans and keeps its lorry slot', () => {
    const p = planRing(3, 'normal', { route: 'full' });
    expect(p.route).toBe('full');
    expect(p.landmarks).toHaveLength(10);
    expect(checkPlan(p)).toEqual([]);
    expect(p.bosses.map((b) => b.landmark)).toEqual(['westpoort', 'exit']);
  });
});

describe('the URLs (revision R)', () => {
  it('a section picks the route: short landmarks, zwaan and the foot sections short; an unused landmark full', () => {
    expect(ringRouteFor(undefined)).toBe('short');
    for (const s of ['oost', 'amstel', 'zuid', 'zwaan', 'rf-a', 'rf-b']) expect(ringRouteFor(s), s).toBe('short');
    for (const s of ['nieuwe-meer', 'west', 'westpoort', 'coentunnel', 'noord', 'zeeburg', 'exit']) expect(ringRouteFor(s), s).toBe('full');
    expect(ringRouteFor('amstel', 'full')).toBe('full');
    expect(ringRouteFor('west', 'short')).toBe('short');
    expect(isFootSection('rf-a')).toBe(true);
    expect(isFootSection('zuid')).toBe(false);
  });

  it('section=zwaan starts a short run-in before the truck in zuid; a landmark a run-in before it', () => {
    const plan = planRing(5);
    const slot = plan.bosses[0];
    expect(ringStartDist(plan, 'zwaan')).toBe(slot.at - RING.runIn);
    expect(startStretch({ seed: 5, plan, section: 'zwaan' })).toBe('zuid');
    const amstel = plan.landmarks.find((l) => l.id === 'amstel')!;
    expect(ringStartDist(plan, 'amstel')).toBe(amstel.start - RING.runIn);
    expect(ringStartDist(plan, undefined)).toBe(0);
    expect(startStretch({ seed: 5, plan, section: 'rf-b' })).toBe('rf-b');
  });
  it('?route= is a launch param (absent unless set; anything else is ignored)', () => {
    expect(parseLaunchParams('?mission=ring&route=full').route).toBe('full');
    expect(parseLaunchParams('?mission=ring&route=SHORT').route).toBe('short');
    expect('route' in parseLaunchParams('?mission=ring')).toBe(false);
    expect(parseLaunchParams('?route=loop').route).toBeUndefined();
    expect(ringRouteParam(parseLaunchParams('?route=full'))).toBe('full');
    expect(ringRouteParam(parseLaunchParams(''))).toBeNull();
  });
});
