/**
 * The ring generator (docs/design/ring.md §4, §13 "Generator"; docs/api/ring.md "The generator").
 *
 * `planRing(seed, difficulty)` is a PURE function: its own `Rng` stream
 * (`new Rng(seed).fork('ring/plan')`), so the plan never depends on combat, on who plays or on a
 * P2 join. It lays the ten fixed landmarks (landmarks.ts) in their real clockwise order and lets
 * the director (director.ts) generate the road between them: the chunk grammar, the budget curve,
 * every spawn decision (lane, variant, side, params), the hostages, the items and the golden
 * record. The drivers are the squad roster shuffled by the plan rng (the runner gives each slot
 * the first one nobody plays).
 *
 * `checkPlan(plan)` lists every broken invariant (empty for every generated plan; the tests run
 * it over many seeds).
 */
import { Rng } from '../../engine/rng';
import { ROSTER } from '../scenes/flow-data';
import type { Difficulty } from '../session';
import {
  AHEAD,
  chunkIndexAt,
  chunkTicks,
  directRing,
  enemyGaps,
  isRingEnemy,
  planTicksAt,
  repairGaps,
  RING_CONTENT_WAVE,
  RING_PLAN,
  totalTicks,
  type RingContentWave,
} from './director';
import { RING_ENTITY, RING_LANDMARKS } from './ids';
import { EXIT_NAMES, landmarkDef } from './landmarks';
import { RING, type RingChunk, type RingExitSign, type RingPlan, type RingStretch } from './types';

export { CHUNK_LEN } from './director';

/** Options of `planRing` (tests and the wave-B integrator). */
export interface RingPlanOptions {
  /** The content wave to plan for (default `RING_CONTENT_WAVE`). */
  readonly wave?: RingContentWave;
}

/** The whole ring for a seed and a difficulty (pure). */
export function planRing(seed: number, difficulty: Difficulty = 'normal', o: RingPlanOptions = {}): RingPlan {
  const wave = o.wave ?? RING_CONTENT_WAVE;
  const rng = new Rng(seed >>> 0).fork('ring/plan');
  const drivers = rng.fork('drivers').shuffle([...ROSTER]);
  const r = directRing(rng.fork('director'), difficulty, wave);
  const stretches: RingStretch[] = r.landmarks.map((lm, i) => {
    const end = i + 1 < r.landmarks.length ? r.landmarks[i + 1].start : r.length;
    let ticks = 0;
    for (const c of r.chunks) if (c.start >= lm.start && c.start < end) ticks += chunkTicks(c);
    return { id: lm.id, index: i, start: lm.start, end, district: landmarkDef(lm.id).roadDistrict, ticks: Math.round(ticks) };
  });
  return {
    seed: seed >>> 0,
    difficulty,
    length: r.length,
    landmarks: r.landmarks,
    stretches,
    chunks: r.chunks,
    spawns: r.spawns,
    bosses: r.bosses,
    drivers,
    goldenRecord: r.goldenRecord,
    hostages: r.hostages,
    ticks: r.ticks,
    exitSigns: exitSigns(r.landmarks, stretches, r.chunks),
    wave,
  };
}

/**
 * Direction-sign spots: each stretch's S-exits spread over its road (the on-ramp's S113 at the
 * boarding, the exit's S113 on its gantry), never inside a tunnel.
 */
function exitSigns(landmarks: RingPlan['landmarks'], stretches: readonly RingStretch[], chunks: readonly RingChunk[]): RingExitSign[] {
  const out: RingExitSign[] = [];
  stretches.forEach((st, i) => {
    const lm = landmarks[i];
    const exits = lm.exits ?? [];
    if (!exits.length) return;
    if (lm.id === 'exit') {
      out.push({ at: lm.start + 192, exit: exits[0], name: EXIT_NAMES[exits[0]] ?? '', stretch: st.id });
      return;
    }
    // The road after the fixed part (set piece + `after`).
    let road = st.start;
    for (const c of chunks) if (c.start >= st.start && c.start < st.end && c.setPiece) road = c.start + c.length;
    exits.forEach((exit, k) => {
      let at: number;
      if (lm.id === 'oost' && k === 0) at = lm.start + 96;
      else {
        const n = lm.id === 'oost' ? exits.length - 1 : exits.length;
        const j = lm.id === 'oost' ? k - 1 : k;
        at = Math.round(road + ((st.end - road) * (j + 0.5)) / n);
      }
      const c = chunks[chunkIndexAt(chunks, at)];
      if (c?.type === 'tunnel') at = c.start + c.length + 64;
      out.push({ at, exit, name: EXIT_NAMES[exit] ?? '', stretch: st.id });
    });
  });
  return out;
}

/** The chunk at a plan distance (null outside the plan). */
export function chunkAt(plan: Pick<RingPlan, 'chunks'>, d: number): RingChunk | null {
  return plan.chunks[chunkIndexAt(plan.chunks, d)] ?? null;
}

/** Planned ticks until the view's left edge reaches plan distance `d` (the planned speeds). */
export function planTicks(plan: Pick<RingPlan, 'chunks'>, d: number): number {
  return planTicksAt(plan.chunks, d);
}

/** Spawns whose lane must be open where they are (the cars, crates, enemies on the road). */
const LANE_BOUND = new Set<string>([RING_ENTITY.car, RING_ENTITY.crate, RING_ENTITY.scooter]);

/**
 * Every broken invariant of a plan (docs/api/ring.md "The generator"): empty = good. Checks the
 * landmarks (all ten, in order, contiguous stretches), the chunks (no gaps, bridges and tunnels
 * only in set pieces, 3 lanes in tunnels), the planned time (9:00 ± 5 %), an open lane
 * everywhere, the jams (1–2, no closure in or next to one), exactly one golden record, ≥ 1
 * hostage per stretch, a repair chance at least every ~60 s, the 4-second enemy estimate, the
 * boss slots, the drivers, a rest after each peak, the run-ins before each landmark, spawns on
 * open lanes inside the plan.
 */
export function checkPlan(plan: RingPlan): string[] {
  const out: string[] = [];
  const bad = (msg: string): void => {
    if (out.length < 40) out.push(msg);
  };
  // Landmarks and stretches.
  const ids = plan.landmarks.map((l) => l.id).join();
  if (ids !== RING_LANDMARKS.join()) bad(`landmarks out of order: ${ids}`);
  if (plan.stretches.length !== plan.landmarks.length) bad('a stretch per landmark');
  let prevEnd = 0;
  plan.stretches.forEach((st, i) => {
    if (st.id !== plan.landmarks[i]?.id || st.start !== plan.landmarks[i]?.start) bad(`stretch ${st.id} does not start at its landmark`);
    if (st.start !== prevEnd) bad(`stretch ${st.id} leaves a gap at ${prevEnd}`);
    if (st.end <= st.start) bad(`stretch ${st.id} is empty`);
    prevEnd = st.end;
  });
  if (prevEnd !== plan.length) bad('the stretches do not end at the plan length');
  // Chunks: contiguous, set-piece types, lanes.
  let d = 0;
  for (const c of plan.chunks) {
    if (c.start !== d) bad(`chunk gap at ${d}`);
    d = c.start + c.length;
    if ((c.type === 'bridge' || c.type === 'tunnel') && !c.setPiece) bad(`${c.type} outside a landmark at ${c.start}`);
    const lanes = c.lanes ?? 4;
    if (c.type === 'tunnel' && lanes !== 3) bad(`tunnel with ${lanes} lanes at ${c.start}`);
    const closed = c.closed ?? [];
    if (closed.some((l) => l < 1 || l > lanes)) bad(`closed lane outside the road at ${c.start}`);
    if (lanes - closed.length < 1) bad(`no open lane at ${c.start}`);
    if (c.peak) {
      const next = plan.chunks[plan.chunks.indexOf(c) + 1];
      if (next?.type !== 'rest') bad(`no rest after the peak at ${c.start}`);
    }
  }
  if (d !== plan.length) bad(`chunks end at ${d}, the plan at ${plan.length}`);
  for (const lm of plan.landmarks) {
    if (lm.tunnel && lm.lanes !== 3) bad(`tunnel ${lm.id} not 3 lanes`);
    if (lm.tunnel) {
      for (const s of plan.spawns) if (s.id === RING_ENTITY.gantry && s.at >= lm.start && s.at < lm.start + lm.length) bad(`gantry inside ${lm.id}`);
    }
  }
  // Time.
  const ticks = totalTicks(plan.chunks);
  if (Math.abs(ticks - RING_PLAN.ticks) > RING_PLAN.ticks * RING_PLAN.tolerance) bad(`planned ${Math.round(ticks)} ticks, outside 9:00 ± 5 %`);
  // Jams.
  const jams = plan.chunks.filter((c) => c.type === 'jam');
  if (jams.length < RING_PLAN.jams[0] || jams.length > RING_PLAN.jams[1]) bad(`${jams.length} jams`);
  for (const j of jams) {
    const i = plan.chunks.indexOf(j);
    if (j.closed?.length) bad(`closure inside the jam at ${j.start}`);
    for (const n of [plan.chunks[i - 1], plan.chunks[i + 1]]) if (n?.closed?.length) bad(`closure next to the jam at ${j.start}`);
    if (plan.chunks[i - 1]?.part !== 'jam-warn') bad(`no 50 gantry before the jam at ${j.start}`);
    for (const s of plan.spawns) if (s.id === RING_ENTITY.closure && s.at >= j.start && s.at < j.start + j.length) bad(`closure spawn inside the jam at ${s.at}`);
  }
  // Golden record.
  const golden = plan.spawns.filter((s) => (s.params as { kind?: unknown } | undefined)?.kind === 'golden-record');
  if (golden.length !== 1) bad(`${golden.length} golden records`);
  else if (golden[0].at !== plan.goldenRecord) bad('goldenRecord does not match its spawn');
  // Hostages.
  for (const st of plan.stretches) {
    const n = plan.spawns.filter((s) => (s.params as { hostage?: unknown } | undefined)?.hostage === true && s.at >= st.start && s.at < st.end).length;
    if (n < 1) bad(`no hostage in ${st.id}`);
    if (plan.hostages[st.id] !== n) bad(`hostages[${st.id}] = ${plan.hostages[st.id]}, spawns ${n}`);
  }
  // Repairs and the 4-second estimate.
  for (const g of repairGaps(plan)) if (g.ticks > RING_PLAN.repairTicks) bad(`no repair chance for ${g.ticks} ticks from ${g.from}`);
  for (const g of enemyGaps(plan)) bad(`no enemy for ${g.ticks} ticks from ${g.from}`);
  // Bosses.
  const slot = (lmId: string, id: string): void => {
    const lm = plan.landmarks.find((l) => l.id === lmId);
    const b = plan.bosses.find((x) => x.landmark === lmId);
    if (!lm || !b || b.id !== id || b.at < lm.start || b.at >= lm.start + lm.length) bad(`boss slot ${id} not in ${lmId}`);
  };
  slot('westpoort', 'ring-lorry');
  slot('exit', 'ring-end-boss');
  // Drivers: the whole roster.
  if ([...plan.drivers].sort().join() !== [...ROSTER].sort().join()) bad(`drivers ${plan.drivers.join()}`);
  // Run-ins: a calm chunk before each landmark (a clean `?section=` start).
  for (const lm of plan.landmarks.slice(1)) {
    const i = chunkIndexAt(plan.chunks, lm.start - 1);
    const c = plan.chunks[i];
    if (!c || c.part !== 'run-in' || c.length < RING.runIn || c.closed?.length || c.type === 'jam') bad(`no run-in before ${lm.id}`);
  }
  // Rests and scenes: no enemy appears in them (spec §4: rest = items, no enemies).
  for (const s of plan.spawns) {
    if (!isRingEnemy(s.id)) continue;
    const c = plan.chunks[chunkIndexAt(plan.chunks, s.from === 'behind' ? s.at : s.at - AHEAD)];
    if (c && (c.type === 'rest' || c.scene)) bad(`${s.id} appears in the ${c.part ?? c.type} at ${c.start}`);
  }
  // Spawns: inside the plan, on open lanes.
  for (const s of plan.spawns) {
    if (!(s.at >= 0 && s.at < plan.length)) bad(`spawn ${s.id} at ${s.at} outside the plan`);
    if (s.lane !== undefined && (s.lane < 1 || s.lane > 4)) bad(`spawn ${s.id} in lane ${s.lane}`);
    if (!LANE_BOUND.has(s.id) || s.lane === undefined) continue;
    // A 'behind' entry enters at the view's left edge (`at - spawnBehind`), a road entry at `at`.
    const x = s.from === 'behind' ? Math.max(0, s.at - RING.spawnBehind) : s.at;
    const c = plan.chunks[chunkIndexAt(plan.chunks, x)];
    if (c && ((c.lanes ?? 4) < s.lane || c.closed?.includes(s.lane))) bad(`spawn ${s.id} at ${s.at} in closed lane ${s.lane}`);
  }
  return out;
}
