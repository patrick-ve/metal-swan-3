/**
 * The ring generator (docs/design/ring.md §4, §13 "Generator", §15 `plan`): the same seed gives a
 * deep-equal plan; 50 seeds on every difficulty meet every invariant (`checkPlan`); different
 * seeds differ; difficulty changes only the wave rows; `?section=<landmark>` starts at the
 * landmark with a calm run-in; a P2 join never changes the plan and slot 1 always finds a driver.
 */
import { describe, expect, it } from 'vitest';
import { VirtualPad } from '../../../src/engine/input';
import {
  baseBudget,
  CHUNK_RULES,
  enemyGaps,
  phraseBudget,
  repairGaps,
  RING_CONTENT_WAVE,
  RING_PLAN,
  tierOf,
  totalTicks,
  weaponGaps,
} from '../../../src/game/ring/director';
import { RING_ENTITY, RING_ENTITY_B, RING_ENTITY_B_PARTS, RING_LANDMARKS } from '../../../src/game/ring/ids';
import { formatKm, landmarkDef, RING_LANDMARK_DEFS, ringKmAt } from '../../../src/game/ring/landmarks';
import { checkPlan, chunkAt, planRing } from '../../../src/game/ring/plan';
import { RingRunner } from '../../../src/game/ring/runner';
import { RING, type RingPlan } from '../../../src/game/ring/types';
import { ROSTER } from '../../../src/game/scenes/flow-data';
import { GameSession, type Difficulty } from '../../../src/game/session';
import { RingRig } from './ring-helpers';

const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard'];
const WAVE_A = new Set<string>(Object.values(RING_ENTITY));
const WAVE_B = new Set<string>(Object.values(RING_ENTITY_B));

const kindOf = (p: unknown): unknown => (p as { kind?: unknown } | undefined)?.kind;

describe('planRing: purity and variety', () => {
  it('the same seed gives a deep-equal plan (every difficulty)', () => {
    for (const d of DIFFS) {
      expect(planRing(77, d)).toEqual(planRing(77, d));
      expect(JSON.stringify(planRing(1234567, d))).toBe(JSON.stringify(planRing(1234567, d)));
    }
  });

  it('different seeds give different rings', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) seen.add(JSON.stringify(planRing(seed).chunks.map((c) => [c.type, c.length, c.closed])));
    expect(seen.size).toBe(20);
    expect(JSON.stringify(planRing(5).spawns)).not.toBe(JSON.stringify(planRing(6).spawns));
  });

  it('is fast enough to make at the mission start', () => {
    const t0 = performance.now();
    for (let seed = 1; seed <= 20; seed++) planRing(seed);
    expect((performance.now() - t0) / 20).toBeLessThan(40);
  });
});

describe('planRing: the invariants hold for every seed', () => {
  it('50 seeds × 3 difficulties: checkPlan finds nothing', () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      for (const d of DIFFS) for (const p of checkPlan(planRing(seed * 7919, d))) problems.push(`${seed}/${d}: ${p}`);
    }
    expect(problems).toEqual([]);
  });

  it('wave-B plans (the default since the wave-B integration) meet them too', () => {
    expect(RING_CONTENT_WAVE).toBe('B');
    const problems: string[] = [];
    const used = new Set<string>();
    let boarders = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const p = planRing(seed);
      expect(p.wave).toBe('B');
      for (const x of checkPlan(p)) problems.push(`${seed}: ${x}`);
      for (const s of p.spawns) {
        used.add(s.id);
        // Caravans keep to the two near lanes (spec §11); hostages ride in vans and caravans (§8).
        if (s.id === RING_ENTITY_B.caravan) expect(s.lane, `${seed} caravan`).toBeGreaterThanOrEqual(3);
        if (s.params?.hostage) expect([RING_ENTITY_B.parcelVan, RING_ENTITY_B.caravan]).toContain(s.id);
        // The jam's stand: the scooter gang, then the foot boarders (spec §7.2).
        if (s.id === RING_ENTITY.jam) {
          const waves = (s.params?.waves ?? []) as { id: string; lane: number }[][];
          expect(waves.length).toBe(2);
          for (const m of waves[1]) {
            expect(m.id).toBe(RING_ENTITY_B_PARTS.boarder);
            boarders++;
          }
        }
      }
    }
    expect(problems).toEqual([]);
    expect(boarders).toBeGreaterThan(15);
    for (const id of [RING_ENTITY_B.parcelVan, RING_ENTITY_B.caravan, RING_ENTITY_B.handhaverMoto, RING_ENTITY_B.scanCar, RING_ENTITY_B.towTruck, RING_ENTITY_B.roadworks]) expect(used).toContain(id);
  });

  it('wave-A plans name wave-A ids only (the boss slots name the lorry and the end marker)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const p = planRing(seed, 'normal', { wave: 'A' });
      expect(p.wave).toBe('A');
      for (const s of p.spawns) expect(WAVE_A.has(s.id), s.id).toBe(true);
      expect(p.bosses.map((b) => [b.landmark, b.id])).toEqual([
        ['westpoort', 'ring-lorry'],
        ['exit', 'ring-end-boss'],
      ]);
      expect(WAVE_B.has(p.bosses[0].id)).toBe(true);
    }
  });

  it('the planned time is 9:00 ± 5 % and the parts add up', () => {
    let lo = Infinity;
    let hi = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const p = planRing(seed);
      const t = totalTicks(p.chunks);
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
      expect(p.ticks).toBe(Math.round(t));
      expect(p.stretches.reduce((n, s) => n + (s.ticks ?? 0), 0)).toBeCloseTo(t, -1);
    }
    expect(lo).toBeGreaterThanOrEqual(RING_PLAN.ticks * 0.95);
    expect(hi).toBeLessThanOrEqual(RING_PLAN.ticks * 1.05);
    // Each seed lands near its 8:45 target (the lorry's fight comes on top in play).
    expect(lo).toBeGreaterThanOrEqual(RING_PLAN.target * 0.97);
    expect(hi).toBeLessThanOrEqual(RING_PLAN.target * 1.03);
  });

  it('exactly one golden record, ≥ 1 hostage per stretch, repairs every ~60 s, weapons often', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = planRing(seed);
      const golden = p.spawns.filter((s) => kindOf(s.params) === 'golden-record');
      expect(golden).toHaveLength(1);
      expect(golden[0].id).toBe(RING_ENTITY.crate);
      expect(golden[0].at).toBe(p.goldenRecord);
      for (const st of p.stretches) expect(p.hostages[st.id]).toBeGreaterThanOrEqual(1);
      expect(Math.max(...repairGaps(p).map((g) => g.ticks))).toBeLessThanOrEqual(RING_PLAN.repairTicks);
      // GDD §1.5 rule 3: the first weapon in the first 20 s; then about every 45 s (a jam may stretch it).
      const w = weaponGaps(p);
      expect(w[0].ticks).toBeLessThanOrEqual(RING_PLAN.firstWeaponTicks);
      expect(Math.max(...w.map((g) => g.ticks))).toBeLessThanOrEqual(3_600);
      expect(enemyGaps(p)).toEqual([]);
    }
  });

  it('every hazard of wave A shows up: closures, cameras, the West zone, 1–2 jams behind a 50', () => {
    const count = (p: RingPlan, id: string): number => p.spawns.filter((s) => s.id === id).length;
    for (let seed = 1; seed <= 20; seed++) {
      const p = planRing(seed);
      const jams = p.chunks.filter((c) => c.type === 'jam');
      expect(jams.length).toBeGreaterThanOrEqual(1);
      expect(jams.length).toBeLessThanOrEqual(2);
      expect(count(p, RING_ENTITY.jam)).toBe(jams.length);
      const zones = p.chunks.filter((c) => c.type === 'avgzone');
      expect(zones.map((z) => z.stretch)).toEqual(['west']);
      expect(count(p, RING_ENTITY.avgzone)).toBe(2);
      expect(count(p, RING_ENTITY.gantry)).toBeGreaterThan(4);
      expect(count(p, RING_ENTITY.closure)).toBeGreaterThan(0);
      expect(count(p, RING_ENTITY.speedcam) + count(p, RING_ENTITY.closure)).toBeGreaterThan(2);
      // Civilian cover and the scooter gang everywhere.
      expect(count(p, RING_ENTITY.car)).toBeGreaterThan(80);
      expect(count(p, RING_ENTITY.scooter)).toBeGreaterThan(100);
    }
  });
});

describe('planRing: the landmarks', () => {
  const plan = planRing(42);

  it('all ten, in the real clockwise order, the S-exits counting down', () => {
    expect(plan.landmarks.map((l) => l.id)).toEqual([...RING_LANDMARKS]);
    expect(plan.landmarks.flatMap((l) => l.exits ?? [])).toEqual([
      'S113', 'S112', 'S111', 'S110', 'S109', 'S108', 'S107', 'S106', 'S105', 'S104', 'S103', 'S102', 'S101',
      'S118', 'S117', 'S116', 'S115', 'S114', 'S113',
    ]);
    expect((plan.exitSigns ?? []).map((s) => s.exit)).toEqual(plan.landmarks.flatMap((l) => l.exits ?? []));
    for (let i = 1; i < plan.landmarks.length; i++) expect(plan.landmarks[i].start).toBeGreaterThan(plan.landmarks[i - 1].start);
  });

  it('fixed set pieces: same lengths for every seed; tunnels 3 lanes; bridges only at landmarks', () => {
    const other = planRing(9001);
    expect(other.landmarks.map((l) => [l.id, l.length, l.lanes, l.tunnel ?? false])).toEqual(plan.landmarks.map((l) => [l.id, l.length, l.lanes, l.tunnel ?? false]));
    expect(plan.landmarks.filter((l) => l.tunnel).map((l) => l.id)).toEqual(['coentunnel', 'zeeburg']);
    const bridges = plan.chunks.filter((c) => c.type === 'bridge').map((c) => c.part);
    expect(bridges).toEqual(['rozenoordbrug', 'schinkelbrug', 'kanaal', 'zeeburgerbrug']);
    for (const c of plan.chunks) if (c.type === 'tunnel') expect(c.lanes).toBe(3);
    // A10 West: 80 km/h on its signs and chunks.
    expect(plan.landmarks.find((l) => l.id === 'west')?.limit).toBe(80);
    for (const c of plan.chunks) expect(c.limit).toBe(c.stretch === 'west' ? 80 : 100);
  });

  it('the hectometre posts rise from about 13, wrap to 0 at Coenplein, about 9–10 at the Zeeburgertunnel', () => {
    const at = (id: string): number => plan.landmarks.find((l) => l.id === id)!.start;
    expect(ringKmAt(plan, 0)).toBeCloseTo(13, 1);
    const coen = plan.landmarks.find((l) => l.id === 'coentunnel')!;
    expect(ringKmAt(plan, coen.start)).toBeGreaterThan(30);
    expect(ringKmAt(plan, coen.start + coen.length - 1)).toBeGreaterThan(32);
    expect(ringKmAt(plan, coen.start + coen.length + 1)).toBeLessThan(0.5);
    expect(ringKmAt(plan, at('zeeburg'))).toBeGreaterThanOrEqual(8.5);
    expect(ringKmAt(plan, at('zeeburg'))).toBeLessThanOrEqual(10);
    expect(ringKmAt(plan, plan.length - 1)).toBeGreaterThan(12.5);
    // Rising everywhere apart from the wrap.
    let prev = ringKmAt(plan, 0);
    let wraps = 0;
    for (let d = 512; d < plan.length; d += 512) {
      const k = ringKmAt(plan, d);
      if (k < prev - 1) wraps++;
      else expect(k).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
    expect(wraps).toBe(1);
    expect(formatKm(12.3)).toBe('12,3');
    expect(formatKm(0)).toBe('0,0');
  });

  it('the boss slots: the test lorry in westpoort, the end marker at the exit, the off-ramp last', () => {
    const wp = plan.landmarks.find((l) => l.id === 'westpoort')!;
    expect(plan.bosses[0]).toMatchObject({ id: 'ring-lorry', landmark: 'westpoort', at: wp.start + landmarkDef('westpoort').boss!.offset });
    const last = plan.chunks[plan.chunks.length - 1];
    expect(last).toMatchObject({ part: 'offramp', scene: true, stretch: 'exit' });
    expect(plan.chunks[0]).toMatchObject({ part: 'boarding', scene: true, stretch: 'oost' });
    expect(RING_LANDMARK_DEFS.map((d) => d.id)).toEqual([...RING_LANDMARKS]);
  });
});

describe('planRing: the grammar and the director', () => {
  it('the budget rises 0.2 → 1.0 over the loop; a rest follows every peak', () => {
    expect(baseBudget(0)).toBeCloseTo(0.2);
    expect(baseBudget(1)).toBeCloseTo(1);
    expect(phraseBudget(1, 4, 5)).toBe(1);
    expect(phraseBudget(0, 0, 4)).toBeLessThan(phraseBudget(0, 3, 4));
    expect(tierOf(0.2)).toBe(0);
    expect(tierOf(0.9)).toBe(3);
    const p = planRing(3);
    const gen = p.chunks.filter((c) => !c.setPiece && c.type !== 'rest');
    const firstHalf = gen.slice(0, gen.length / 2).reduce((n, c) => n + (c.budget ?? 0), 0) / (gen.length / 2);
    const secondHalf = gen.slice(gen.length / 2).reduce((n, c) => n + (c.budget ?? 0), 0) / (gen.length - gen.length / 2);
    expect(secondHalf).toBeGreaterThan(firstHalf + 0.2);
    const peaks = p.chunks.filter((c) => c.peak);
    expect(peaks.length).toBeGreaterThan(8);
    for (const c of peaks) expect(p.chunks[p.chunks.indexOf(c) + 1].type).toBe('rest');
    // Rests hold no enemy that starts in them, and every rest has a crate.
    for (const c of p.chunks.filter((x) => x.type === 'rest')) {
      const crates = p.spawns.filter((s) => s.id === RING_ENTITY.crate && s.at >= c.start && s.at < c.start + c.length);
      expect(crates.length).toBeGreaterThan(0);
    }
  });

  it('neighbour rules: no two closures in a row, no closure next to a jam, always an open lane', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = planRing(seed);
      p.chunks.forEach((c, i) => {
        const prev = p.chunks[i - 1];
        if (c.closed?.length && prev?.closed?.length) expect(prev.part === 'warn' || prev.type !== c.type, `${seed} @${c.start}`).toBe(true);
        if (c.type === 'jam') {
          expect(prev.part).toBe('jam-warn');
          expect(p.chunks[i + 1]?.closed ?? []).toEqual([]);
        }
        expect((c.lanes ?? 4) - (c.closed?.length ?? 0)).toBeGreaterThanOrEqual(c.lanes === 3 ? 3 : 2);
        expect(c.length).toBeGreaterThan(0);
        if (!c.setPiece && c.type !== 'rest' && c.part === undefined && c.type !== 'jam') {
          const r = CHUNK_RULES[c.type];
          expect(c.length).toBeGreaterThanOrEqual(r.len[0] - 16);
        }
      });
    }
  });

  it('difficulty only changes the wave rows: the road, traffic, hazards and items stay', () => {
    for (const seed of [2, 31, 404]) {
      const [e, n, h] = DIFFS.map((d) => planRing(seed, d));
      expect(e.chunks).toEqual(n.chunks);
      expect(h.chunks).toEqual(n.chunks);
      // The jam's own waves (its `waves` param: a scooter gang and the boarders in its stand) are
      // wave rows too; every wave member carries its `gang` number (hostage carriers do not).
      const noWaves = (s: RingPlan['spawns'][number]): unknown => (s.id === RING_ENTITY.jam ? { ...s, params: { ...s.params, waves: undefined } } : s);
      const calm = (p: RingPlan): string => JSON.stringify(p.spawns.filter((s) => s.params?.gang === undefined).map(noWaves));
      expect(calm(e)).toBe(calm(n));
      expect(calm(h)).toBe(calm(n));
      const jamScooters = (p: RingPlan): number =>
        p.spawns.filter((s) => s.id === RING_ENTITY.jam).reduce((a, s) => a + ((s.params?.waves as unknown[][] | undefined) ?? []).flat().length, 0);
      const sc = (p: RingPlan): number => p.spawns.filter((s) => s.id === RING_ENTITY.scooter).length + jamScooters(p);
      expect(sc(e)).toBeLessThan(sc(n));
      expect(sc(n)).toBeLessThan(sc(h));
      expect(jamScooters(e)).toBeLessThanOrEqual(jamScooters(n));
      expect(jamScooters(n)).toBeLessThanOrEqual(jamScooters(h));
    }
  });

  it('spawn params: cars per lane (far fast from behind, near slow ahead), the jam queue, gangs numbered, hostages carry an item', () => {
    const p = planRing(8);
    for (const s of p.spawns) {
      const params = s.params as Record<string, unknown> | undefined;
      if (s.id === RING_ENTITY.car && params?.jam) {
        // The jam's queue: it drives in from the right to its stand (`stopAt`, screen x).
        expect(s.from).toBeUndefined();
        expect(params.stopAt).toBeGreaterThanOrEqual(0);
        expect(params.stopAt).toBeLessThan(384);
        expect(params.rel).toBeLessThan(0);
      }
      if (s.id === RING_ENTITY.car && !params?.jam) {
        const rel = params?.rel as number;
        expect(Math.abs(rel)).toBeGreaterThanOrEqual(0.2);
        if (rel > 0) expect(s.from).toBe('behind');
        else expect(s.from).toBeUndefined();
        if (s.lane! <= 2) expect(rel).toBeGreaterThan(0);
        else expect(rel).toBeLessThan(0);
        expect(['hatch', 'estate', 'van', 'taxi', 'camper', 'box-truck']).toContain(params?.model);
        if (params?.model === 'camper' || params?.model === 'box-truck') expect(s.lane).toBeGreaterThanOrEqual(3);
      }
      if (s.id === RING_ENTITY.scooter) {
        expect(params?.gang).toBeGreaterThan(0);
        expect(params?.index).toBeLessThan(params?.size as number);
        expect(['behind', 'ahead', 'near']).toContain(params?.side);
        expect(['bottle', 'pistol']).toContain(params?.pillion);
      }
      if (params?.hostage) {
        // Wave B: the hostages ride in parcel vans and caravans (spec §8).
        expect([RING_ENTITY_B.parcelVan, RING_ENTITY_B.caravan]).toContain(s.id);
        expect(typeof params.item).toBe('string');
        expect(s.lane).toBeGreaterThanOrEqual(3);
      }
    }
    expect(chunkAt(p, 0)?.part).toBe('boarding');
    expect(chunkAt(p, p.length)).toBeNull();
  });
});

describe('planRing in the runner', () => {
  it('?section=<landmark> starts at the landmark with a calm run-in', () => {
    const plan = planRing(17);
    for (const lm of plan.landmarks) {
      const session = new GameSession({ characters: ['vincent'], seed: 17 });
      const runner = new RingRunner({ session, pads: [new VirtualPad(), new VirtualPad()], seed: 17, plan, section: lm.id });
      runner.world.god = true;
      runner.start();
      const start = Math.max(0, lm.start - RING.runIn);
      expect(runner.planDist).toBe(start);
      const c = chunkAt(plan, start)!;
      if (lm.id !== 'oost') {
        expect(c.part, lm.id).toBe('run-in');
        expect(c.closed ?? []).toEqual([]);
      }
      for (let i = 0; i < Math.ceil(RING.runIn / RING.cruiseSpeed) + 4; i++) runner.update();
      expect(runner.stretch?.id).toBe(lm.id);
      expect(runner.report().errors).toEqual([]);
      runner.dispose();
    }
  });

  it('a P2 join never changes the plan; slot 1 always finds its own driver', () => {
    const plan = planRing(23);
    const before = JSON.stringify(plan);
    for (const c1 of ROSTER) {
      for (const c2 of ROSTER) {
        const rig = new RingRig({ characters: [c1], plan, seed: 23, god: true });
        const r = rig.runner;
        const d0 = r.drivers[0];
        expect(d0).not.toBeNull();
        expect(d0).not.toBe(c1);
        rig.run(5);
        r.joinPlayer(1, c2);
        rig.run(5);
        const d1 = r.drivers[1];
        expect(d1, `${c1}+${c2}`).not.toBeNull();
        expect(d1).not.toBe(d0);
        const playing = rig.session.slots.filter((s) => s.joined).map((s) => s.character);
        expect(playing).not.toContain(d0);
        expect(playing).not.toContain(d1);
        expect(r.drivers[0]).toBe(d0);
        r.dispose();
      }
    }
    expect(JSON.stringify(plan)).toBe(before);
    // The drivers come from the plan rng: the whole roster, and not always in the same order.
    const orders = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) orders.add(planRing(seed).drivers.join());
    expect(orders.size).toBeGreaterThan(3);
    for (const o of orders) expect(o.split(',').sort()).toEqual([...ROSTER].sort());
  });
});
