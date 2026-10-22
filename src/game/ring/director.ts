/**
 * The ring's director (docs/design/ring.md §4, §13 "Generator"; docs/api/ring.md "The generator").
 *
 * `planRing` (plan.ts) calls `directRing(rng, difficulty, wave)`; everything here is a pure
 * function of the plan rng, so the plan never depends on combat or on who plays.
 *
 * LAYERS (each layer has its own fork of the plan rng, so a change in one layer never reshuffles
 * another):
 * 1. STRUCTURE (`'structure'`): the landmark set pieces (landmarks.ts) and, between them, the
 *    generated road: PHRASES of 3–5 chunks whose budget rises to a PEAK, then a `rest`; a calm
 *    `run-in` chunk ends every stretch (a clean start for `?section=`). The chunk GRAMMAR
 *    (`CHUNK_RULES`): length ranges, threat costs, minimum tiers, pick weights, the content wave
 *    whose ids a type needs, neighbour rules. Forced per ring: 1–2 jams (each behind a `50`
 *    gantry), the average-speed zone on A10 West. The total is normalised to 8:45 ± 2 %
 *    (`RING_PLAN.target`; the invariant allows 9:00 ± 5 %) at the planned speeds (`chunkTicks`).
 * 2. HAZARDS (`'hazards'`): gantries, closures, speed cameras, the zone signs, the jam controller.
 * 3. HOSTAGES (`'hostages'`): ≥ 1 per stretch (wave A: a civilian van with `hostage: true`).
 * 4. TRAFFIC (`'traffic'`): civilians per lane (far lanes fast from behind, near lanes slow
 *    ahead) at a target density per chunk; the jam's queue.
 * 5. ENEMIES (`'enemies'`): a threat BANK fed by the budget curve buys wave templates; a wave is
 *    forced in when the 4-second estimate would break (GDD §1.5 rule 1).
 * 6. ITEMS (`'items'`): crates in rests, a weapon at least every ~45 s, a repair chance at least
 *    every ~60 s (forced at 45 s), the first weapon in the first 20 s.
 * 7. GOLDEN (`'golden'`): exactly one golden record, in a crate on the far lane, mid-ring.
 *
 * DIFFICULTY changes only wave rows (GDD §4.10): members marked `N` spawn on NORMAL and HARD,
 * `H` only on HARD. Every random draw happens on every difficulty, so the layout of a seed is the
 * same; the coverage estimate counts base members only (true on every difficulty).
 */
import type { Rng } from '../../engine/rng';
import type { Difficulty } from '../session';
import { RING_ENTITY, RING_ENTITY_B, RING_ENTITY_B_PARTS, type RingCarModel, type RingLandmarkId, type RingRoute } from './ids';
import { fixedLength, RING_LANDMARK_DEFS, routeDefs, setPieceLength, wrapKm, type RingLandmarkDef, type RingSetPieceChunk } from './landmarks';
import { SHOULDER_TOP } from './lanes';
import { RING, type RingBossSlot, type RingChunk, type RingChunkType, type RingLandmark, type RingSpawn } from './types';

// =============================================================================================
// Tuning
// =============================================================================================

/** The content wave a plan is made for: 'A' = wave-A ids only; 'B' adds the wave-B templates. */
export type RingContentWave = 'A' | 'B';

/** The content that exists today (wave B is in: the integrator flipped it, 2026-10-21). */
export const RING_CONTENT_WAVE: RingContentWave = 'B';

/** Width of the view (logical px) and the spawn point of road entries beyond its right edge. */
const VIEW_W = 384;
/** A road entry at plan distance `at` spawns when the view's left edge reaches `at - AHEAD`. */
export const AHEAD = VIEW_W + RING.spawnAhead;

export const RING_PLAN = Object.freeze({
  /** 9:00 at the planned speeds (spec §13) … */
  ticks: 32_400,
  /**
   * … and the target each seed draws around (± `jitter`): 8:45. The plan part of a run; the test
   * lorry's fight (35–55 s, the plan is locked) comes on top, so whole rings land at about
   * 34,000–36,000 ticks (spec §15: 31,000–36,000). Fixer B, 2026-10-21: with the 9:00 target god and
   * normal runs reached 36,600–36,900.
   */
  target: 31_500,
  /** … within ± 5 % (the invariant); each seed draws its target within ± `jitter`. */
  tolerance: 0.05,
  jitter: 0.02,
  /**
   * Threat points per 512 px of road at budget 1.0 (the bank's income, above the 4-second floor).
   * Integrator 2026-10-20: 0.55 → 0.45 once the forced floor came at 120 ticks and scooters leave
   * after their stay (seeds 1-3 with the bot: scooters on screen p50 3-4, p90 6-8, max 13).
   * User play-test 2026-10-21 ("too many enemies, I get stuck"): 0.45 → 0.28.
   */
  threat: 0.28,
  /** The bank never holds more than this (no huge burst after a calm part). */
  bankMax: 1.0,
  /** GDD §1.5 rule 1: no more than this many ticks without an enemy on screen (estimate). */
  gapTicks: 240,
  /**
   * A forced wave comes when the estimate passes this many ticks without an enemy (integrator,
   * 2026-10-20: the bot kills a gang well inside its estimate; placed at the 210-tick mark the
   * play had gaps of 5-10 s, at 150 up to 5 s, at 120 the longest is 198-250 ticks, seeds 1-5).
   * User play-test 2026-10-21 (too many enemies): 90 → 130, with the smaller gangs (at 170 the bot's
   * 1P runs went 5 s without an enemy; at 130 the longest is 227-260 ticks, seeds 1-3).
   */
  gapPlace: 130,
  /** The same mark in a jam chunk (its gangs stay longer: the stopped cars are cover). */
  gapJam: 130,
  /** The director forces a wave this many ticks before the gap limit. */
  gapMargin: 30,
  /** Voluntary waves start at least this far (px) apart (user play-test 2026-10-21: 224 → 384) … */
  waveSpacing: 384,
  /** … and not this close before a rest or a scene. */
  quietBefore: 160,
  /** A repair chance at least every ~60 s (the invariant) … */
  repairTicks: 3_600,
  /** … the director places one when this many ticks passed without one. */
  repairSoon: 2_640,
  /** A rest's crate is a repair when this many ticks passed since the last one. */
  repairRest: 1_500,
  /** GDD §1.5 rule 3: a weapon at least every ~45 s; the first one in the first 20 s. */
  weaponTicks: 2_640,
  firstWeaponTicks: 1_200,
  /** Phrase length (chunks before the rest). */
  phrase: [3, 5] as readonly [number, number],
  /** Jams per ring (spec §4: at most 2). */
  jams: [1, 2] as readonly [number, number],
  /** A jam: the road crawls at `jamCrawl` px/tick and stands still `jamHold` ticks in its middle. */
  jamCrawl: 1.2,
  jamHold: 150,
  /**
   * The jam's queue (`ring-car` with `jam: true` and `stopAt`, the screen x it drives in to and
   * stands at while the jam holds): stands every `jamStop` px per lane, a wide gap now and then.
   * `jamCars: false` leaves the queue to the jam controller (it gets a `seed` param either way).
   */
  jamCars: true,
  jamStop: [96, 140] as readonly [number, number],
  jamGap: [150, 200] as readonly [number, number],
  /** Screen speed (px/tick) of a queue car driving in, and the spawn spacing of a lane's queue (px). */
  jamRel: -0.5,
  jamSpawnGap: 120,
  /**
   * Civilian screen speeds per lane (`rel`, px/tick against the road; world speed = road speed +
   * rel): far lanes overtake you (they enter from behind), near lanes are overtaken (they are on
   * the road ahead). The same values as the traffic content's defaults (`LANE_REL`).
   */
  laneRel: [0.7, 0.3, -0.35, -0.75] as readonly number[],
  /** Share of the civilians per lane (1 far … 4 near). */
  laneShare: [0.2, 0.25, 0.3, 0.25] as readonly number[],
  /** Minimum distance between two civilians in a lane while both are on screen (px; 2026-10-21: 150 → 220). */
  carGap: 220,
  /**
   * Two cars in different lanes closer than this (px, along the road) run abreast. A new car never
   * makes a wall: at least two open lanes stay free of abreast cars (`wallFree`; user play-test
   * 2026-10-21: "more often I get stuck" — boxed in by traffic).
   */
  abreast: 170,
  /** A civilian's lane is open this far (plan px) past its entry (further on it merges out). */
  carClearAhead: 640,
  /** Stretch run-in: the calm last chunk of each stretch (≥ `RING.runIn`). */
  runIn: [384, 768] as readonly [number, number],
  /**
   * Revision R (docs/design/ring.md §R.2): the SHORT route's road part (the boarding … the start of
   * the boss chunk) is 2:00 at the planned speeds (`short.ticks`, the invariant allows ± 5 %); each
   * seed draws around `short.target` ± `jitter`. No mid-drive jam; exactly one gantry closure and
   * one speed camera (forced into `amstel` and `zuid`), at most one road-works chunk.
   */
  short: Object.freeze({
    ticks: 7_200,
    target: 7_200,
    /** Forced chunk types per stretch of the short route. */
    forced: Object.freeze({ amstel: ['gantry'], zuid: ['speedcam'] }) as Readonly<Partial<Record<RingLandmarkId, readonly RingChunkType[]>>>,
    /** Chunk types the grammar never picks on the short route (the forced ones and the jam). */
    never: ['gantry', 'speedcam', 'jam', 'avgzone'] as readonly RingChunkType[],
    roadworks: 1,
    /**
     * Fixer (2026-10-22): the forced-wave mark on the short route (the full route keeps `gapPlace`).
     * At 130 the bot's longest gap reached 243-266 ticks on some seeds (the 4-second rule is 240);
     * at 110 still 245-259, at 90 one 242; at 80 the longest is 164-218 (god seeds 1-10, 2P 1-3)
     * for about 5-10 % more kills.
     */
    gapPlace: 80,
  }),
});

/** Chunk length the grammar is tuned around (spec §4: about 512 px). */
export const CHUNK_LEN = 512;

// =============================================================================================
// The grammar
// =============================================================================================

/** One chunk type of the grammar. */
export interface ChunkRule {
  readonly type: RingChunkType;
  /** Length range (px; drawn in steps of 32). A gantry's range holds its 384-px warning part. */
  readonly len: readonly [number, number];
  /** Threat points its own set-up takes from the bank. */
  readonly cost: number;
  /** Lowest tier (0 … 3) it appears at. */
  readonly minTier: number;
  /** Pick weight (0 = never picked by the grammar: set pieces, forced or inserted types). */
  readonly weight: number;
  /** The content wave whose ids it needs. */
  readonly wave: RingContentWave;
  /** The bank may place enemy waves in it. */
  readonly enemies: boolean;
  /** Civilians on screen while the view is in it (a target; 0 = none). */
  readonly traffic: number;
  /** It closes lanes (never next to another closure or a jam). */
  readonly closes?: boolean;
  /** At most this many per stretch. */
  readonly maxPerStretch?: number;
  /** Not before this many planned ticks into the ring (a gentle start). */
  readonly minTicks?: number;
  /** Never twice in a row. */
  readonly noRepeat?: boolean;
}

// User play-test 2026-10-21 ("the traffic is too much, more often I get stuck"): every chunk's
// traffic about halved (was cruise 2.5, traffic 7.5, merge / gantry / roadworks / bridge 3,
// speedcam / parcel / caravan 2.5, avgzone / tunnel 3.5, convoy 2, rest 1.5).
export const CHUNK_RULES: Readonly<Record<RingChunkType, ChunkRule>> = {
  cruise: { type: 'cruise', len: [384, 640], cost: 0, minTier: 0, weight: 3, wave: 'A', enemies: true, traffic: 1.5 },
  traffic: { type: 'traffic', len: [512, 768], cost: 0.05, minTier: 0, weight: 3, wave: 'A', enemies: true, traffic: 4 },
  merge: { type: 'merge', len: [512, 640], cost: 0.1, minTier: 0, weight: 1.2, wave: 'A', enemies: true, traffic: 2, noRepeat: true },
  gantry: { type: 'gantry', len: [896, 1152], cost: 0.1, minTier: 0, weight: 1.2, wave: 'A', enemies: true, traffic: 1.5, closes: true, maxPerStretch: 2, noRepeat: true, minTicks: 900 },
  roadworks: { type: 'roadworks', len: [640, 1024], cost: 0.15, minTier: 1, weight: 1, wave: 'A', enemies: true, traffic: 1.5, closes: true, maxPerStretch: 1, noRepeat: true },
  speedcam: { type: 'speedcam', len: [384, 512], cost: 0.05, minTier: 0, weight: 1, wave: 'A', enemies: true, traffic: 1.5, maxPerStretch: 2, noRepeat: true, minTicks: 600 },
  avgzone: { type: 'avgzone', len: [1536, 2048], cost: 0.05, minTier: 0, weight: 0, wave: 'A', enemies: true, traffic: 2, maxPerStretch: 1 },
  jam: { type: 'jam', len: [640, 896], cost: 0.2, minTier: 1, weight: 0, wave: 'A', enemies: true, traffic: 0, maxPerStretch: 1 },
  rest: { type: 'rest', len: [384, 512], cost: 0, minTier: 0, weight: 0, wave: 'A', enemies: false, traffic: 1 },
  parcel: { type: 'parcel', len: [512, 768], cost: 0.4, minTier: 0, weight: 1.5, wave: 'B', enemies: true, traffic: 1.5, noRepeat: true },
  caravan: { type: 'caravan', len: [512, 768], cost: 0.5, minTier: 1, weight: 1, wave: 'B', enemies: true, traffic: 1.5, noRepeat: true },
  convoy: { type: 'convoy', len: [768, 1024], cost: 0.8, minTier: 2, weight: 1, wave: 'B', enemies: true, traffic: 1, maxPerStretch: 1, noRepeat: true },
  bridge: { type: 'bridge', len: [512, 512], cost: 0, minTier: 0, weight: 0, wave: 'A', enemies: true, traffic: 2 },
  tunnel: { type: 'tunnel', len: [1024, 1280], cost: 0, minTier: 0, weight: 0, wave: 'A', enemies: true, traffic: 2 },
};

/** The budget curve over the loop (spec §13: 0.2 → 1.0); `p` = planned-time progress 0 … 1. */
export function baseBudget(p: number): number {
  return 0.2 + 0.8 * Math.min(1, Math.max(0, p));
}

/** The budget of chunk `k` of a phrase of `n`: it rises to the phrase's peak (the last chunk). */
export function phraseBudget(p: number, k: number, n: number): number {
  const m = 0.75 + 0.35 * (n > 1 ? k / (n - 1) : 1);
  return round2(Math.min(1, Math.max(0.1, baseBudget(p) * m)));
}

/** Tier of a budget: 0 (< 0.35), 1 (< 0.55), 2 (< 0.8), 3. */
export function tierOf(budget: number): number {
  return budget < 0.35 ? 0 : budget < 0.55 ? 1 : budget < 0.8 ? 2 : 3;
}

// =============================================================================================
// The time model (planned speeds)
// =============================================================================================

/** Planned road speed over a chunk (px/tick). */
export function chunkSpeed(c: Pick<RingChunk, 'speed'>): number {
  return c.speed ?? RING.cruiseSpeed;
}

/** Planned ticks of a chunk: its length at its speed plus its hold. */
export function chunkTicks(c: Pick<RingChunk, 'length' | 'speed' | 'hold'>): number {
  return c.length / chunkSpeed(c) + (c.hold ?? 0);
}

const tickCache = new WeakMap<readonly RingChunk[], Float64Array>();

function cumTicks(chunks: readonly RingChunk[]): Float64Array {
  let t = tickCache.get(chunks);
  if (t) return t;
  t = new Float64Array(chunks.length + 1);
  for (let i = 0; i < chunks.length; i++) t[i + 1] = t[i] + chunkTicks(chunks[i]);
  tickCache.set(chunks, t);
  return t;
}

/** Index of the chunk holding plan distance `d` (binary search; -1 outside the chunks). */
export function chunkIndexAt(chunks: readonly RingChunk[], d: number): number {
  let lo = 0;
  let hi = chunks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = chunks[mid];
    if (d < c.start) hi = mid - 1;
    else if (d >= c.start + c.length) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * Planned ticks from the plan start until the view's left edge reaches plan distance `d` (the
 * chunks must cover [0, length) without gaps; `d` past the end counts at cruise speed).
 */
export function planTicksAt(chunks: readonly RingChunk[], d: number): number {
  const cum = cumTicks(chunks);
  if (chunks.length === 0 || d <= 0) return Math.max(0, d) / RING.cruiseSpeed;
  const last = chunks[chunks.length - 1];
  if (d >= last.start + last.length) return cum[chunks.length] + (d - last.start - last.length) / RING.cruiseSpeed;
  const i = chunkIndexAt(chunks, d);
  const c = chunks[i];
  const into = d - c.start;
  return cum[i] + into / chunkSpeed(c) + (c.hold && into >= (c.holdAt ?? 0) ? c.hold : 0);
}

/** Total planned ticks of a list of chunks. */
export function totalTicks(chunks: readonly RingChunk[]): number {
  return cumTicks(chunks)[chunks.length];
}

// =============================================================================================
// Wave templates
// =============================================================================================

/** The end slot's id: a marker (no entity yet; the runner skips it, so it locks nothing). */
const END_BOSS_MARKER = 'ring-end-boss';

/** Enemy entity ids (the 4-second estimate) and their estimated time on screen (ticks). */
export const ENEMY_PRESENCE: Readonly<Record<string, number>> = {
  // Measured with the ring bot (integrator, 2026-10-20: 1,318 scooters, seeds 1-3 normal): the
  // median scooter is on screen 142-154 ticks (p25 about 60); 240 left gaps of 5-10 s in play.
  [RING_ENTITY.scooter]: 150,
  // Wave B (integrator, 2026-10-21: the wave-B bot on seeds 1-5 normal, time on screen alive;
  // under the p10 mark, so a fast kill rarely leaves a gap behind the estimate; at the p25 mark
  // god runs of seeds 6-15 showed 5-6 s gaps after a van shot early, and two players kill a van
  // in about 150 ticks — the plan never depends on the player count): motos p25 60 / p50
  // 113; vans p10 289 / p25 737 (hostage vans count the same); caravans p10 244 / p25 386; the scan car
  // p10 230 / p25 497, the tow truck p10 99 / p25 224; the road-works truck 450 (it leaves on its
  // own); boarders p25 78 / p50 188.
  [RING_ENTITY_B.handhaverMoto]: 90,
  [RING_ENTITY_B.parcelVan]: 240,
  [RING_ENTITY_B.caravan]: 200,
  [RING_ENTITY_B.scanCar]: 240,
  [RING_ENTITY_B.towTruck]: 200,
  [RING_ENTITY_B.roadworks]: 450,
  [RING_ENTITY_B.lorry]: 600,
  [RING_ENTITY_B_PARTS.boarder]: 120,
};

/**
 * The estimated time on screen of a spawn (ticks; undefined = not an enemy). A hostage carrier (a
 * van or a caravan with `hostage`) counts like its plain twin: the estimate uses the same p10 mark,
 * and a separate table with the same values was dead code (review B, 2026-10-21).
 */
export function presenceOf(s: Pick<RingSpawn, 'id' | 'params'>): number | undefined {
  return ENEMY_PRESENCE[s.id];
}

/** Is `id` an enemy (for the 4-second estimate)? */
export function isRingEnemy(id: string): boolean {
  return ENEMY_PRESENCE[id] !== undefined;
}

/** A wave row (GDD §4.10): '' always, 'N' on NORMAL and HARD, 'H' on HARD only. */
export type WaveRow = '' | 'N' | 'H';

/** One member of a wave, relative to the wave's spot. */
export interface WaveMember {
  readonly id: string;
  /** 'behind' enters from the left; 'ahead' is on the road ahead; 'near' joins up an on-ramp (lane 4). */
  readonly side: 'behind' | 'ahead' | 'near';
  /** Distance (px) after the wave's spot. */
  readonly dx: number;
  /** Lane offset from the wave's base lane (or a fixed lane with `fixedLane`). */
  readonly lane: number;
  readonly fixedLane?: boolean;
  readonly row: WaveRow;
  readonly params: Record<string, unknown>;
}

export interface WaveTemplate {
  readonly id: string;
  readonly wave: RingContentWave;
  readonly minTier: number;
  /** Threat points (counted with the NORMAL rows). */
  readonly cost: number;
  /** Pick weight (by tier 0 … 3). */
  readonly weight: readonly number[];
  /** Only in these chunk types (a chunk's fixed template), else anywhere enemies may be. */
  readonly only?: readonly RingChunkType[];
  /** Picked with weight × `prefer.weight` in these chunk types. */
  readonly prefer?: { readonly types: readonly RingChunkType[]; readonly weight: number };
  readonly build: (rng: Rng, tier: number) => WaveMember[];
}

/** A pillion's weapon: bottles first, then pistols (spec §5.1). */
function pillion(rng: Rng, tier: number): 'bottle' | 'pistol' {
  if (tier === 0) return 'bottle';
  return rng.chance(tier === 1 ? 0.4 : 0.6) ? 'pistol' : 'bottle';
}

const LANE_FAN = [0, 1, -1, 2, -2];

/** A scooter gang: `rows` per member, from `side`, spaced `step` px. */
function gang(rng: Rng, tier: number, side: WaveMember['side'], rows: readonly WaveRow[], step: number, extra: Record<string, unknown> = {}): WaveMember[] {
  const out: WaveMember[] = [];
  for (let k = 0; k < rows.length; k++) {
    out.push({
      id: RING_ENTITY.scooter,
      side,
      dx: k * step + rng.int(0, 6),
      lane: LANE_FAN[k % LANE_FAN.length],
      row: rows[k],
      params: { side, pillion: pillion(rng, tier), lead: k === 0, ...extra },
    });
  }
  return out;
}

/**
 * The wave templates (wave A: the scooter gang; wave B: the gangs and the convoy). User play-test
 * 2026-10-21 (too many enemies): every scooter gang one base member less (EASY 2, NORMAL 3, HARD 4;
 * the pincer 2 / 3 / 4).
 */
export const WAVE_TEMPLATES: readonly WaveTemplate[] = [
  {
    id: 'gang-behind',
    wave: 'A',
    minTier: 0,
    cost: 0.4,
    weight: [3, 3, 2, 2],
    build: (rng, tier) => gang(rng, tier, 'behind', ['', '', 'N', 'H'], 20),
  },
  {
    id: 'gang-ahead',
    wave: 'A',
    minTier: 0,
    cost: 0.4,
    weight: [2, 2, 2, 2],
    build: (rng, tier) => gang(rng, tier, 'ahead', ['', '', 'N', 'H'], 56),
  },
  {
    id: 'gang-weave',
    wave: 'A',
    minTier: 1,
    cost: 0.5,
    weight: [0, 1.5, 2, 2],
    build: (rng, tier) => gang(rng, tier, 'behind', ['', '', 'N', 'H'], 24, { weave: 'wide' }),
  },
  {
    id: 'gang-pincer',
    wave: 'A',
    minTier: 2,
    cost: 0.5,
    weight: [0, 0, 1.5, 2],
    build: (rng, tier) => {
      const a = gang(rng, tier, 'behind', ['', 'N'], 20, { pincer: true });
      const b = gang(rng, tier, 'ahead', ['', 'H'], 56, { pincer: true });
      return [...a, ...b.map((m) => ({ ...m, lane: -m.lane + 1, params: { ...m.params, lead: false } }))];
    },
  },
  {
    id: 'gang-merge',
    wave: 'A',
    minTier: 0,
    cost: 0.35,
    weight: [0.3, 0.3, 0.3, 0.3],
    prefer: { types: ['merge'], weight: 12 },
    build: (rng, tier) => gang(rng, tier, 'near', ['', '', 'N'], 40, { merge: true }).map((m) => ({ ...m, lane: 4, fixedLane: true })),
  },
  // ---- wave B (CONVOY / GANGS builders; the plan names them when made with wave 'B') --------
  {
    id: 'moto-pair',
    wave: 'B',
    minTier: 1,
    cost: 0.35,
    weight: [0, 1, 1, 1],
    build: (rng) => [
      { id: RING_ENTITY_B.handhaverMoto, side: 'behind', dx: 0, lane: 0, row: '', params: { attack: rng.chance(0.5) ? 'baton' : 'sticker' } },
      { id: RING_ENTITY_B.handhaverMoto, side: 'behind', dx: 40, lane: 1, row: '', params: { attack: rng.chance(0.5) ? 'baton' : 'sticker' } },
      { id: RING_ENTITY_B.handhaverMoto, side: 'behind', dx: 80, lane: -1, row: 'H', params: { attack: 'baton' } },
    ],
  },
  {
    id: 'parcel-van',
    wave: 'B',
    minTier: 0,
    cost: 0.4,
    weight: [0, 0, 0, 0],
    only: ['parcel'],
    build: (rng) => [
      {
        id: RING_ENTITY_B.parcelVan,
        side: 'ahead',
        dx: 0,
        lane: 0,
        row: '',
        params: { crew: rng.chance(0.5) ? 'thrower' : 'gunner', brakeCheck: rng.chance(0.5) },
      },
    ],
  },
  {
    id: 'caravan',
    wave: 'B',
    minTier: 1,
    cost: 0.5,
    weight: [0, 0, 0, 0],
    only: ['caravan'],
    // Caravans keep to the two near lanes (spec §11): a fixed lane 3 or 4.
    build: (rng) => [{ id: RING_ENTITY_B.caravan, side: 'ahead', dx: 0, lane: rng.chance(0.5) ? 3 : 4, fixedLane: true, row: '', params: { gunner: true, looseAfter: rng.int(240, 420) } }],
  },
  {
    id: 'convoy',
    wave: 'B',
    minTier: 2,
    cost: 0.8,
    weight: [0, 0, 0, 0],
    only: ['convoy'],
    build: () => [
      { id: RING_ENTITY_B.scanCar, side: 'ahead', dx: 0, lane: 0, row: '', params: {} },
      { id: RING_ENTITY_B.towTruck, side: 'behind', dx: 60, lane: 1, row: '', params: {} },
      { id: RING_ENTITY_B.handhaverMoto, side: 'behind', dx: 120, lane: -1, row: '', params: { attack: 'sticker' } },
      { id: RING_ENTITY_B.handhaverMoto, side: 'behind', dx: 160, lane: 2, row: 'H', params: { attack: 'baton' } },
    ],
  },
  {
    id: 'roadworks-crew',
    wave: 'B',
    minTier: 1,
    cost: 0.3,
    weight: [0, 0, 0, 0],
    only: ['roadworks'],
    build: () => [{ id: RING_ENTITY_B.roadworks, side: 'ahead', dx: 0, lane: 0, row: '', params: {} }],
  },
];

const TEMPLATE_BY_ID = new Map(WAVE_TEMPLATES.map((t) => [t.id, t]));

/** The fixed template of a wave-B chunk type (null: the bank's templates only). */
function fixedTemplateOf(type: RingChunkType): WaveTemplate | null {
  for (const t of WAVE_TEMPLATES) if (t.only?.includes(type)) return t;
  return null;
}

// =============================================================================================
// Items
// =============================================================================================

/** Weapon crates on the ring (no flame shot or bounce mine: they need gravity / terrain, spec §3). */
export const RING_WEAPON_KINDS: readonly string[] = ['M', 'S', 'R', 'L', 'H', 'T'];
const WEAPON_WEIGHTS = [3, 2, 1.5, 1.5, 1.5, 1];
const TREATS: readonly string[] = ['cheese', 'teacake', 'jelly', 'gem', 'medal'];
const TREAT_WEIGHTS = [3, 3, 2, 2, 1];
/** What a hostage drops into the window (a drop value, content/items/drops.ts). */
const HOSTAGE_DROPS: readonly string[] = ['repair', 'M', 'S', 'R', 'L', 'H', 'bombs', 'cheese', 'gem'];
const HOSTAGE_DROP_WEIGHTS = [3, 1.5, 1, 1, 1, 1, 2, 1, 1];

/** Car models per lane group (camper and box truck keep right, spec §11). */
const FAR_MODELS: readonly RingCarModel[] = ['hatch', 'estate', 'taxi', 'van'];
const FAR_WEIGHTS = [4, 3, 1, 1.5];
const NEAR_MODELS: readonly RingCarModel[] = ['hatch', 'estate', 'van', 'taxi', 'camper', 'box-truck'];
const NEAR_WEIGHTS = [3, 3, 2, 1, 1, 1];
/** `rel` offsets per model (trucks and campers slower, taxis quicker). */
const MODEL_REL: Readonly<Record<RingCarModel, number>> = { hatch: 0, estate: 0, taxi: 0.1, van: -0.1, camper: -0.15, 'box-truck': -0.2 };
/** Civilian colours (`ring-car` param `colour`, 0 … 7). */
export const CAR_COLOURS = 8;

/** A civilian's model for lane `l` (camper and box truck keep right). */
export function pickCarModel(rng: Rng, l: number): RingCarModel {
  return l <= 2 ? FAR_MODELS[rng.weighted(FAR_WEIGHTS)] : NEAR_MODELS[rng.weighted(NEAR_WEIGHTS)];
}

/** A civilian's `rel` (screen speed at cruise) in lane `l`: never near 0 (it must come and go). */
export function carRelOf(l: number, model: RingCarModel): number {
  const r = RING_PLAN.laneRel[l - 1] + MODEL_REL[model];
  return round2(r >= 0 ? Math.max(0.2, r) : Math.min(-0.2, r));
}

// =============================================================================================
// The director
// =============================================================================================

/** A spawn while the plan is made (the row decides the difficulties it spawns on). */
interface WorkSpawn {
  at: number;
  id: string;
  lane?: number;
  y?: number;
  from?: 'road' | 'behind';
  params?: Record<string, unknown>;
  row: WaveRow;
  /** Members of one wave share a gang number (size / index are filled after the row filter). */
  gang?: number;
}

type WorkChunk = { -readonly [K in keyof RingChunk]: RingChunk[K] };

/** What the director hands to plan.ts. */
export interface DirectedRing {
  readonly length: number;
  readonly ticks: number;
  readonly landmarks: RingLandmark[];
  readonly chunks: RingChunk[];
  readonly spawns: RingSpawn[];
  readonly bosses: RingBossSlot[];
  readonly goldenRecord: number;
  readonly hostages: Record<string, number>;
}

/** A car placed by the traffic layer (lane bookkeeping: its plan coordinate over view time). */
interface LaneCar {
  /** View time (the view's left-edge plan distance) of its appearance and exit. */
  t0: number;
  t1: number;
  /** Plan coordinate at t0 and its speed (plan px per view px). */
  p0: number;
  rate: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
const snap32 = (v: number): number => Math.round(v / 32) * 32;

/**
 * Make the ring: the plan's road, spawns and bosses (plan.ts adds drivers, seed, stretches).
 * `route` (revision R): 'full' (default here: the old loop, unchanged) or 'short'.
 */
export function directRing(rng: Rng, difficulty: Difficulty, wave: RingContentWave, route: RingRoute = 'full'): DirectedRing {
  return new Director(rng, difficulty, wave, route).run();
}

class Director {
  private readonly chunks: WorkChunk[] = [];
  private readonly landmarks: RingLandmark[] = [];
  private readonly spawns: WorkSpawn[] = [];
  private readonly bosses: RingBossSlot[] = [];
  private readonly hostages: Record<string, number> = {};
  private readonly laneCars: LaneCar[][] = [[], [], [], []];
  private d = 0;
  private ticks = 0;
  private total = 0;
  private gangs = 0;
  private golden = -1;

  private readonly rng: Rng;
  private readonly difficulty: Difficulty;
  private readonly wave: RingContentWave;
  /** Revision R: the route's landmark defs, the short route, and its road-works count. */
  private readonly defs: readonly RingLandmarkDef[];
  private readonly short: boolean;
  private roadworks = 0;

  constructor(rng: Rng, difficulty: Difficulty, wave: RingContentWave, route: RingRoute = 'full') {
    this.rng = rng;
    this.difficulty = difficulty;
    this.wave = wave;
    this.defs = routeDefs(route);
    this.short = route === 'short';
  }

  run(): DirectedRing {
    this.structure(this.rng.fork('structure'));
    this.hazards(this.rng.fork('hazards'));
    this.placeHostages(this.rng.fork('hostages'));
    this.traffic(this.rng.fork('traffic'));
    this.enemies(this.rng.fork('enemies'));
    this.items(this.rng.fork('items'));
    this.placeGolden(this.rng.fork('golden'));
    return {
      length: this.d,
      ticks: Math.round(totalTicks(this.chunks)),
      landmarks: this.landmarks,
      chunks: this.chunks,
      spawns: this.finishSpawns(),
      bosses: this.bosses,
      goldenRecord: this.golden,
      hostages: this.hostages,
    };
  }

  // ------------------------------------------------------------------------------- structure

  private push(c: Omit<WorkChunk, 'start'>): WorkChunk {
    const chunk = { ...c, start: this.d } as WorkChunk;
    this.chunks.push(chunk);
    this.d += chunk.length;
    this.ticks += chunkTicks(chunk);
    return chunk;
  }

  private structure(rng: Rng): void {
    const defs = this.defs;
    const target = this.short ? RING_PLAN.short.target : RING_PLAN.target;
    this.total = Math.round(target * (1 + rng.range(-RING_PLAN.jitter, RING_PLAN.jitter)));
    let fixed = 0;
    let shares = 0;
    for (const def of defs) {
      fixed += fixedLength(def) / RING.cruiseSpeed;
      shares += def.share;
    }
    const road = this.total - fixed;
    // The jam stretches: 1–2 of the stretches that allow one, never two neighbours (the short
    // route has none: its only jam is the final one in zuid's tail).
    const jamIds = this.short ? [] : this.pickJams(rng);
    let fixedSoFar = 0;
    let shareSoFar = 0;
    for (const def of defs) {
      this.setPiece(def);
      fixedSoFar += fixedLength(def) / RING.cruiseSpeed;
      shareSoFar += def.share;
      if (def.share <= 0) continue;
      // Cumulative targets: an overshoot in one stretch is taken back by the next.
      const end = fixedSoFar + (road * shareSoFar) / shares;
      this.road(rng, def, end, jamIds.includes(def.id), this.short ? (RING_PLAN.short.forced[def.id] ?? []) : []);
      if (def.tail) this.tail(def);
    }
  }

  /** Revision R: the fixed chunks after a stretch's road (the boss chunk, the final jam) and its boss slot. */
  private tail(def: RingLandmarkDef): void {
    const start = this.d;
    for (const c of def.tail ?? []) {
      this.push({
        type: c.type,
        length: c.length,
        stretch: def.id,
        budget: 0,
        tier: 0,
        part: c.part,
        setPiece: true,
        tail: true,
        district: c.district ?? def.roadDistrict,
        limit: def.limit,
        ...(c.speed !== undefined ? { speed: c.speed } : {}),
        ...(c.scene ? { scene: true } : {}),
      });
    }
    if (def.boss?.inTail) this.bosses.push({ at: start + def.boss.offset, id: def.boss.id, landmark: def.id, lane: def.boss.lane });
  }

  private pickJams(rng: Rng): RingLandmarkId[] {
    const allowed = RING_LANDMARK_DEFS.filter((d) => d.jam).map((d) => d.id);
    const n = rng.int(RING_PLAN.jams[0], RING_PLAN.jams[1]);
    const first = rng.pick(allowed);
    const out: RingLandmarkId[] = [first];
    if (n > 1) {
      const order = RING_LANDMARK_DEFS.map((d) => d.id);
      const rest = allowed.filter((id) => Math.abs(order.indexOf(id) - order.indexOf(first)) > 1);
      if (rest.length) out.push(rng.pick(rest));
    }
    return out;
  }

  private progress(): number {
    return this.total > 0 ? this.ticks / this.total : 0;
  }

  /** The landmark set piece (and its `after` chunks), its landmark record and its boss slot. */
  private setPiece(def: RingLandmarkDef): void {
    const start = this.d;
    const len = setPieceLength(def);
    const tunnel = def.setPiece.some((c) => c.type === 'tunnel');
    this.landmarks.push({
      id: def.id,
      district: def.district,
      start,
      length: len,
      lanes: tunnel ? 3 : 4,
      ...(tunnel ? { tunnel: true } : {}),
      exits: [...def.exits],
      name: def.name,
      roadDistrict: def.roadDistrict,
      km: wrapKm(def.ringKm),
      limit: def.limit,
      ...(def.junction ? { junction: def.junction } : {}),
      ...(def.bridge ? { bridge: def.bridge } : {}),
      ...(def.tunnelName ? { tunnelName: def.tunnelName } : {}),
    });
    this.hostages[def.id] = 0;
    const fixedChunk = (c: RingSetPieceChunk): void => {
      const base = baseBudget(this.progress());
      const budget = c.scene ? 0 : round2(base * (c.part === 'boss' ? 0.6 : 0.9));
      this.push({
        type: c.type,
        length: c.length,
        stretch: def.id,
        budget,
        tier: tierOf(budget),
        part: c.part,
        setPiece: true,
        district: c.district ?? def.district,
        limit: def.limit,
        ...(c.lanes === 3 ? { lanes: 3 as const } : {}),
        ...(c.scene ? { scene: true } : {}),
      });
    };
    for (const c of def.setPiece) fixedChunk(c);
    for (const c of def.after ?? []) fixedChunk(c);
    if (def.boss && !def.boss.inTail) this.bosses.push({ at: start + def.boss.offset, id: def.boss.id, landmark: def.id, lane: def.boss.lane });
  }

  /** The generated road of a stretch up to the cumulative target `endTicks`. */
  private road(rng: Rng, def: RingLandmarkDef, endTicks: number, jam: boolean, extra: readonly RingChunkType[] = []): void {
    const forced: RingChunkType[] = [];
    if (def.id === 'west') forced.push('avgzone');
    if (jam) forced.push('jam');
    forced.push(...extra);
    const counts = new Map<RingChunkType, number>();
    let prev: WorkChunk | null = this.chunks[this.chunks.length - 1] ?? null;
    const left = (): number => endTicks - this.ticks;
    // Phrases: 3–5 chunks rising to a peak, then a rest.
    let phrase = 0;
    while (left() > 640 || (forced.length > 0 && left() > 400)) {
      const n = rng.int(RING_PLAN.phrase[0], RING_PLAN.phrase[1]);
      // A forced type goes into a random slot of this phrase (or of the next ones while time lasts).
      const lastChance = left() < 3000;
      const forceAt = forced.length > 0 && (lastChance || rng.chance(0.5) || phrase > 0) ? rng.int(0, n - 1) : -1;
      let emitted = 0;
      for (let k = 0; k < n; k++) {
        if (emitted > 0 && left() < 480) break;
        const budget = phraseBudget(this.progress(), k, n);
        const tier = tierOf(budget);
        if (k === forceAt && forced.length > 0) {
          const type = forced.shift()!;
          prev = this.emit(rng, def, type, budget, tier, prev);
        } else {
          const type = this.choose(rng, tier, prev, counts);
          prev = this.emit(rng, def, type, budget, tier, prev);
        }
        counts.set(prev.type, (counts.get(prev.type) ?? 0) + 1);
        emitted++;
      }
      if (emitted === 0) break;
      prev.peak = true;
      const restLen = snap32(rng.range(CHUNK_RULES.rest.len[0], CHUNK_RULES.rest.len[1]));
      prev = this.push({ type: 'rest', length: restLen, stretch: def.id, budget: 0, tier: prev.tier, district: def.roadDistrict, limit: def.limit });
      phrase++;
    }
    // Forced types that found no phrase (a short stretch): before the fillers.
    while (forced.length > 0) {
      const budget = phraseBudget(this.progress(), 1, 2);
      prev = this.emit(rng, def, forced.shift()!, budget, tierOf(budget), prev);
      prev.peak = true;
      prev = this.push({ type: 'rest', length: 384, stretch: def.id, budget: 0, tier: prev.tier, district: def.roadDistrict, limit: def.limit });
    }
    // Fillers, then the run-in that lands the stretch on its target.
    const min = RING_PLAN.runIn[0];
    let px = Math.round(left() * RING.cruiseSpeed);
    while (px - min >= RING_PLAN.runIn[1]) {
      const len = Math.max(CHUNK_RULES.cruise.len[0], Math.min(640, snap32(px - min - rng.int(0, 128))));
      const type: RingChunkType = rng.chance(0.5) ? 'traffic' : 'cruise';
      const budget = round2(baseBudget(this.progress()) * 0.8);
      prev = this.push({ type, length: len, stretch: def.id, budget, tier: tierOf(budget), district: def.roadDistrict, limit: def.limit });
      px = Math.round(left() * RING.cruiseSpeed);
    }
    const budget = round2(baseBudget(this.progress()) * 0.6);
    this.push({ type: 'cruise', length: Math.max(min, px), stretch: def.id, budget, tier: tierOf(budget), part: 'run-in', district: def.roadDistrict, limit: def.limit });
  }

  /** Pick a chunk type by the grammar. */
  private choose(rng: Rng, tier: number, prev: WorkChunk | null, counts: Map<RingChunkType, number>): RingChunkType {
    const types: RingChunkType[] = [];
    const weights: number[] = [];
    for (const rule of Object.values(CHUNK_RULES)) {
      if (rule.weight <= 0 || rule.minTier > tier || (rule.minTicks ?? 0) > this.ticks) continue;
      if (rule.wave === 'B' && this.wave !== 'B') continue;
      // The short route: its hazards are forced (one each); at most one road-works chunk.
      if (this.short && (RING_PLAN.short.never.includes(rule.type) || (rule.type === 'roadworks' && this.roadworks >= RING_PLAN.short.roadworks))) continue;
      if (!this.neighbourOk(rule, prev)) continue;
      if (rule.maxPerStretch !== undefined && (counts.get(rule.type) ?? 0) >= rule.maxPerStretch) continue;
      types.push(rule.type);
      weights.push(rule.weight);
    }
    const i = rng.weighted(weights);
    return i < 0 ? 'cruise' : types[i];
  }

  /** Neighbour rules: closures never next to a closure or a jam; special types never twice in a row. */
  private neighbourOk(rule: ChunkRule, prev: WorkChunk | null): boolean {
    if (!prev) return true;
    if (rule.closes && (prev.closed?.length || prev.type === 'jam' || prev.part === 'jam-warn')) return false;
    if (rule.noRepeat && prev.type === rule.type) return false;
    return true;
  }

  /** Emit a chunk of `type` (a gantry is a warning chunk + a closure chunk; a jam has its 50 gantry). */
  private emit(rng: Rng, def: RingLandmarkDef, type: RingChunkType, budget: number, tier: number, prev: WorkChunk | null): WorkChunk {
    const rule = CHUNK_RULES[type];
    const base = { stretch: def.id, budget, tier, district: def.roadDistrict, limit: def.limit };
    const len = snap32(rng.range(rule.len[0], rule.len[1]));
    if (type === 'gantry') {
      const closed = rng.pick(tier <= 1 ? CLOSE_LOW : tier === 2 ? CLOSE_MID : CLOSE_HIGH);
      this.push({ ...base, type, length: 384, part: 'warn' });
      return this.push({ ...base, type, length: len - 384, part: 'closure', closed: [...closed] });
    }
    if (type === 'roadworks') {
      this.roadworks++;
      const closed = tier >= 3 && rng.chance(0.5) ? [3, 4] : [4];
      return this.push({ ...base, type, length: len, closed });
    }
    if (type === 'jam') {
      // Never a closure next to a jam: a spacer first, then the 50 gantry, then the jam.
      if (prev && prev.closed?.length) this.push({ ...base, type: 'cruise', length: 384 });
      this.push({ ...base, type: 'gantry', length: 384, part: 'jam-warn' });
      const holdAt = snap32(len * rng.range(0.35, 0.6));
      return this.push({ ...base, type, length: len, speed: RING_PLAN.jamCrawl, hold: RING_PLAN.jamHold, holdAt });
    }
    return this.push({ ...base, type, length: len });
  }

  // ------------------------------------------------------------------------------- lanes

  /** Open lanes at plan distance `x` (the chunk's lanes minus its closed lanes). */
  private openLanes(x: number): number[] {
    const i = chunkIndexAt(this.chunks, Math.min(this.d - 1, Math.max(0, x)));
    const c = this.chunks[i];
    const n = c?.lanes ?? 4;
    const out: number[] = [];
    for (let l = 1; l <= n; l++) if (!c?.closed?.includes(l)) out.push(l);
    return out;
  }

  /** Is lane `l` open over the plan range [p0, p1] (no closure, not the tunnel kerb)? */
  private laneFree(l: number, p0: number, p1: number): boolean {
    const a = Math.max(0, Math.min(p0, p1));
    const b = Math.min(this.d - 1, Math.max(p0, p1));
    let i = chunkIndexAt(this.chunks, a);
    if (i < 0) return false;
    for (; i < this.chunks.length && this.chunks[i].start <= b; i++) {
      const c = this.chunks[i];
      if ((c.lanes ?? 4) < l || c.closed?.includes(l)) return false;
    }
    return true;
  }

  private chunkAt(x: number): WorkChunk {
    return this.chunks[Math.max(0, chunkIndexAt(this.chunks, Math.min(this.d - 1, Math.max(0, x))))];
  }

  // ------------------------------------------------------------------------------- hazards

  private hazards(rng: Rng): void {
    const Y = SHOULDER_TOP + 4;
    let zone = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const end = c.start + c.length;
      const limit = String(c.limit ?? 100);
      if (c.part === 'limit-80') this.add({ at: c.start + 128, id: RING_ENTITY.gantry, y: Y, params: { purpose: 'limit', signs: [limit, limit, limit, limit] } });
      if (c.type === 'gantry' && c.part === 'warn') {
        const closed = this.chunks[i + 1]?.closed ?? [];
        const signs = [1, 2, 3, 4].map((l) => (closed.includes(l) ? (l <= 2 ? 'arrow-near' : 'arrow-far') : limit));
        this.add({ at: c.start + 96, id: RING_ENTITY.gantry, y: Y, params: { purpose: 'warn', signs } });
      }
      if (c.type === 'gantry' && c.part === 'closure') {
        const closed = c.closed ?? [];
        this.add({ at: c.start + 16, id: RING_ENTITY.gantry, y: Y, params: { purpose: 'close', signs: [1, 2, 3, 4].map((l) => (closed.includes(l) ? 'x' : limit)) } });
        closed.forEach((l, k) => this.add({ at: c.start + 64, id: RING_ENTITY.closure, lane: l, params: { kind: 'gantry', length: c.length - 96, truck: k === 0 } }));
        this.add({ at: end - 32, id: RING_ENTITY.gantry, y: Y, params: { purpose: 'end', signs: ['end', 'end', 'end', 'end'] } });
      }
      if (c.part === 'jam-warn') this.add({ at: c.start + 96, id: RING_ENTITY.gantry, y: Y, params: { purpose: 'jam', signs: ['50', '50', '50', '50'] } });
      if (c.type === 'jam' && c.part === 'final-jam') {
        // Revision R: the final jam (never clears, no waves; JAM+FOOT's controller and the alight).
        this.add({ at: c.start, id: RING_ENTITY.jam, y: Y, from: 'behind', params: { final: true, length: c.length, crawl: c.speed ?? RING_PLAN.jamCrawl, hold: 0, holdAt: 0, cars: 8 } });
      } else if (c.type === 'jam') {
        this.add({
          at: c.start,
          id: RING_ENTITY.jam,
          y: Y,
          from: 'behind',
          params: { length: c.length, crawl: c.speed ?? RING_PLAN.jamCrawl, hold: c.hold ?? 0, holdAt: c.holdAt ?? 0, ...this.jamWaveParams(rng, c) },
        });
      }
      if (c.type === 'roadworks') {
        const closed = c.closed ?? [];
        closed.forEach((l, k) => this.add({ at: c.start + 32, id: RING_ENTITY.closure, lane: l, params: { kind: 'roadworks', length: c.length - 64, truck: k === 0 } }));
      }
      if (c.type === 'speedcam') {
        const kind = rng.chance(0.5) ? 'post' : 'gantry';
        this.add({ at: c.start + snap32(rng.range(128, c.length - 96)), id: RING_ENTITY.speedcam, y: Y, params: { kind } });
      }
      if (c.type === 'avgzone') {
        zone++;
        this.add({ at: c.start + 64, id: RING_ENTITY.avgzone, y: Y, params: { part: 'start', zone, length: c.length - 128 } });
        this.add({ at: end - 64, id: RING_ENTITY.avgzone, y: Y, params: { part: 'end', zone } });
      }
      if (c.stretch === 'exit' && c.part === 'boss') {
        this.add({ at: c.start + 320, id: RING_ENTITY.gantry, y: Y, params: { purpose: 'exit', exit: 'S113', signs: ['blank', 'blank', 'arrow-near', 'arrow-near'] } });
      }
    }
  }

  private add(s: Omit<WorkSpawn, 'row'> & { row?: WaveRow }): void {
    this.spawns.push({ row: '', ...s });
  }

  // ------------------------------------------------------------------------------- traffic

  /**
   * The view-time window (left-edge plan distances) a civilian of screen speed `rel` spends on
   * screen at cruise, and its plan coordinate over that time.
   */
  private carWindow(rel: number, s: number): LaneCar & { at: number; from: 'road' | 'behind' } {
    const cruise = RING.cruiseSpeed;
    const rate = (cruise + rel) / cruise;
    if (rel > 0) {
      // From behind: appears 48 px left of the view at view time s, leaves past the right edge.
      const p0 = s - RING.spawnBehind;
      const t1 = s + ((VIEW_W + RING.spawnBehind + 100) * cruise) / rel;
      return { at: s, from: 'behind', t0: s, t1, p0, rate };
    }
    // Ahead: spawned 64 px beyond the right edge at view time s; leaves past the left edge.
    const at = s + AHEAD;
    const t1 = s + ((AHEAD + 100) * cruise) / -rel;
    return { at, from: 'road', t0: s, t1, p0: at, rate };
  }

  /**
   * Can a car with `win` go into lane `l`: the lane open near its entry (the cars merge out of a
   * lane that closes further on by themselves), and its spacing to the lane's cars on screen.
   */
  private carFits(l: number, win: LaneCar): boolean {
    const reach = Math.min((win.t1 - win.t0) * win.rate, RING_PLAN.carClearAhead);
    if (!this.laneFree(l, win.p0 - 64, win.p0 + reach)) return false;
    for (const o of this.laneCars[l - 1]) {
      const a = Math.max(o.t0, win.t0);
      const b = Math.min(o.t1, win.t1);
      if (a > b) continue;
      const da = o.p0 + (a - o.t0) * o.rate - (win.p0 + (a - win.t0) * win.rate);
      const db = o.p0 + (b - o.t0) * o.rate - (win.p0 + (b - win.t0) * win.rate);
      if (Math.sign(da) !== Math.sign(db) || Math.min(Math.abs(da), Math.abs(db)) < RING_PLAN.carGap) return false;
    }
    return this.wallFree(l, win, this.minOpen(win.p0 - 64, win.p0 + reach));
  }

  /** The fewest open lanes over the plan range [p0, p1]. */
  private minOpen(p0: number, p1: number): number {
    const a = Math.max(0, Math.min(p0, p1));
    const b = Math.min(this.d - 1, Math.max(p0, p1));
    let i = chunkIndexAt(this.chunks, a);
    if (i < 0) return 4;
    let n = 4;
    for (; i < this.chunks.length && this.chunks[i].start <= b; i++) {
      const c = this.chunks[i];
      n = Math.min(n, (c.lanes ?? 4) - (c.closed?.length ?? 0));
    }
    return n;
  }

  /**
   * A new car in lane `l` with `win` never makes a wall: while it is on screen, the lanes with a
   * car abreast of it (within `RING_PLAN.abreast` px), its own lane counted, stay at most `open`
   * − 2 (at least 1), so two open lanes stay free beside every car (four lanes: pairs at most;
   * a tunnel or a closure: one car at a time).
   */
  private wallFree(l: number, win: LaneCar, open: number): boolean {
    const others = Math.max(1, open - 2) - 1;
    const w = RING_PLAN.abreast;
    const spans: [number, number, number][] = [];
    for (let m = 1; m <= 4; m++) {
      if (m === l) continue;
      for (const o of this.laneCars[m - 1]) {
        const a = Math.max(o.t0, win.t0);
        const b = Math.min(o.t1, win.t1);
        if (a > b) continue;
        // The gap along the road is linear in view time: the span where it is under `w`.
        const da = o.p0 + (a - o.t0) * o.rate - (win.p0 + (a - win.t0) * win.rate);
        const db = o.p0 + (b - o.t0) * o.rate - (win.p0 + (b - win.t0) * win.rate);
        let lo = a;
        let hi = b;
        if (b > a && da !== db) {
          const k = (db - da) / (b - a);
          const t1 = a + (-w - da) / k;
          const t2 = a + (w - da) / k;
          lo = Math.max(a, Math.min(t1, t2));
          hi = Math.min(b, Math.max(t1, t2));
        } else if (Math.abs(da) >= w) continue;
        if (lo >= hi && !(lo === hi && Math.abs(da) < w)) continue;
        if (others === 0) return false;
        spans.push([m, lo, hi]);
      }
    }
    // Two other lanes abreast at the same time make a wall of three.
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        if (spans[i][0] !== spans[j][0] && spans[i][1] < spans[j][2] && spans[j][1] < spans[i][2]) return false;
      }
    }
    return true;
  }

  /** Civilians of lane `l` estimated on screen at view time `s`. */
  private onScreen(l: number, s: number): number {
    let n = 0;
    for (const o of this.laneCars[l - 1]) if (o.t0 <= s && s < o.t1) n++;
    return n;
  }

  private keepCar(l: number, win: LaneCar): void {
    const list = this.laneCars[l - 1];
    list.push({ t0: win.t0, t1: win.t1, p0: win.p0, rate: win.rate });
    // Only cars still on screen matter (windows are a few thousand px long).
    if (list.length > 24) list.splice(0, list.length - 24);
  }

  /** A civilian's `rel` (screen speed at cruise) in lane `l`: never near 0 (it must come and go). */
  private carRel(l: number, model: RingCarModel): number {
    return carRelOf(l, model);
  }

  private pickModel(rng: Rng, l: number): RingCarModel {
    return pickCarModel(rng, l);
  }

  /** Target civilians on screen while the view is in chunk `c`. */
  private density(c: WorkChunk): number {
    if (c.part === 'offramp') return 0;
    if (c.part === 'boarding') return 1;
    if (c.part === 'boss') return c.stretch === 'exit' ? 1 : 1.5;
    return CHUNK_RULES[c.type].traffic;
  }

  private traffic(rng: Rng): void {
    // The jam windows: no free-flowing civilians appear while a jam (or its 50 gantry) is near.
    const quiet: [number, number][] = [];
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (c.type !== 'jam') continue;
      const warn = this.chunks[i - 1];
      quiet.push([(warn?.start ?? c.start) - AHEAD, c.start + c.length]);
    }
    const inQuiet = (s: number): boolean => quiet.some(([a, b]) => s >= a && s < b);
    // Per lane: keep floor(want) cars on screen at once, and the fraction as a rate (a car every
    // window / fraction view px on average), so a `traffic` chunk fills up at once and thins out
    // as its cars leave.
    const next = [0, 0, 0, 0].map(() => rng.int(0, 160));
    const last = [-1e9, -1e9, -1e9, -1e9];
    for (let s = 0; s < this.d - VIEW_W; s += 32) {
      const c = this.chunkAt(s + VIEW_W / 2);
      const dens = this.density(c);
      for (let l = 1; l <= 4; l++) {
        const want = dens * RING_PLAN.laneShare[l - 1] * (c.part === 'boarding' && l >= 3 ? 0 : 1);
        if (want <= 0 || inQuiet(s) || s - last[l - 1] < 160) continue;
        const count = this.onScreen(l, s);
        const base = Math.floor(want);
        const frac = want - base;
        let place = count < base;
        if (!place && count <= base && s >= next[l - 1] && frac > 0) {
          const screenPx = ((AHEAD + 100) * RING.cruiseSpeed) / Math.abs(RING_PLAN.laneRel[l - 1]);
          next[l - 1] = s + (screenPx / frac) * rng.range(0.6, 1.4);
          place = true;
        }
        if (!place) continue;
        const model = this.pickModel(rng, l);
        const colour = rng.int(0, CAR_COLOURS - 1);
        const rel = this.carRel(l, model);
        const win = this.carWindow(rel, s);
        if (win.at < this.d && this.carFits(l, win)) {
          this.keepCar(l, win);
          this.add({ at: win.at, id: RING_ENTITY.car, lane: l, from: win.from, params: { model, colour, rel } });
          last[l - 1] = s;
        }
      }
    }
    // Merge chunks: one or two cars join up the on-ramp into lane 4.
    for (const c of this.chunks) {
      if (c.type !== 'merge' || c.scene) continue;
      const n = rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const s = c.start + 64 + k * 128 + rng.int(0, 48);
        const model = this.pickModel(rng, 4);
        const rel = this.carRel(4, model);
        const win = this.carWindow(rel, s);
        if (!this.carFits(4, win)) continue;
        this.keepCar(4, win);
        this.add({ at: win.at, id: RING_ENTITY.car, lane: 4, params: { model, colour: rng.int(0, CAR_COLOURS - 1), rel, merge: true } });
      }
    }
    // The jam's queue: when the jam begins, cars come in from the right in every lane and stand
    // at their `stopAt` (screen x) while the jam holds; a wide gap now and then (lane changes
    // only into gaps). Spawned in stand order (the leftmost stand first) just past the right edge.
    for (const c of this.chunks) {
      if (c.type !== 'jam') continue;
      const seed = rng.int(1, 0x7fffffff);
      const jam = this.spawns.find((x) => x.id === RING_ENTITY.jam && x.at === c.start);
      if (jam?.params) jam.params.seed = seed;
      // The final jam (revision R) builds its own standing queue (the controller's `cars` tail).
      if (!RING_PLAN.jamCars || c.part === 'final-jam') continue;
      for (let l = 1; l <= (c.lanes ?? 4); l++) {
        let stop = rng.int(8, 48);
        let k = 0;
        while (stop < VIEW_W - 24) {
          const model = this.pickModel(rng, l);
          // One car length and a gap apart, so they never spawn on top of each other.
          const at = c.start + AHEAD + 16 + k * RING_PLAN.jamSpawnGap + rng.int(0, 16);
          this.add({ at, id: RING_ENTITY.car, lane: l, params: { model, colour: rng.int(0, CAR_COLOURS - 1), rel: RING_PLAN.jamRel, stopAt: stop, jam: true } });
          const r = rng.chance(0.3) ? RING_PLAN.jamGap : RING_PLAN.jamStop;
          stop += rng.int(r[0], r[1]);
          k++;
        }
      }
    }
  }

  // ------------------------------------------------------------------------------- hostages

  private placeHostages(rng: Rng): void {
    for (const lm of this.landmarks) {
      const st = this.stretchRange(lm.id);
      const n = st.end - st.start >= 12_000 ? 2 : 1;
      // A boss in the stretch's tail (the short route's truck) comes after its hostages.
      const after = this.bosses.find((b) => b.landmark === lm.id && !this.chunkAt(b.at).tail)?.at ?? -1;
      for (let k = 0; k < n; k++) {
        // Spread the carriers: the k-th one in the k-th part of the stretch.
        const a = st.start + ((st.end - st.start) * k) / n;
        const b = st.start + ((st.end - st.start) * (k + 1)) / n;
        const spots: number[] = [];
        // The van's road point (s + AHEAD) stays inside the stretch (the tally counts it there).
        for (let s = Math.max(a, after + 32); s + AHEAD < b - 32; s += 32) {
          const c = this.chunkAt(s + VIEW_W / 2);
          if (c.scene || c.tail || c.type === 'jam' || c.part === 'jam-warn' || c.stretch !== lm.id) continue;
          // Wave B: the carriers are enemy vehicles, so never in a rest (spec §4).
          const here = this.chunkAt(s);
          if (here.scene || here.tail || (this.wave === 'B' && (here.type === 'rest' || c.type === 'rest'))) continue;
          spots.push(s);
        }
        rng.shuffle(spots);
        for (const s of spots.slice(0, 12)) {
          const l = rng.chance(0.5) ? 3 : 4;
          const rel = this.carRel(l, 'van');
          const win = this.carWindow(rel, s);
          if (!this.carFits(l, win)) continue;
          this.keepCar(l, win);
          const item = HOSTAGE_DROPS[rng.weighted(HOSTAGE_DROP_WEIGHTS)];
          if (this.wave === 'B') {
            const id = rng.chance(0.5) ? RING_ENTITY_B.parcelVan : RING_ENTITY_B.caravan;
            this.add({ at: win.at, id, lane: l, params: { hostage: true, item } });
          } else {
            this.add({ at: win.at, id: RING_ENTITY.car, lane: l, params: { model: 'van', colour: rng.int(0, CAR_COLOURS - 1), rel, hostage: true, item } });
          }
          this.hostages[lm.id]++;
          break;
        }
      }
    }
  }

  private stretchRange(id: RingLandmarkId): { start: number; end: number } {
    const i = this.landmarks.findIndex((l) => l.id === id);
    const start = this.landmarks[i].start;
    const end = i + 1 < this.landmarks.length ? this.landmarks[i + 1].start : this.d;
    return { start, end };
  }

  // ------------------------------------------------------------------------------- enemies

  /**
   * The jam's waves during its stand (the jam controller's `waves` param: one after the other).
   * Wave A: one scooter gang that filters in from behind between the stopped cars (wave B adds
   * the foot boarders). A fork of the layer's rng (the other draws stay as they are); every row is
   * drawn on every difficulty, then the difficulty's rows are kept.
   */
  private jamWaveParams(rng: Rng, c: WorkChunk): Record<string, unknown> {
    const r = rng.fork(`ring/jam-waves:${c.start}`);
    const waves = this.jamWaves(r, c);
    // EASY: a small gang filters in when the stand ends (the jam controller's `after`). Its thin
    // stand waves are shot fast, and the plan's floor after the stand counts the gangs that came
    // in during the stand as if they came after it: the crawl went 270 ticks without an enemy
    // (polish 2026-10-21, GDD 1.5). Drawn last from the jam's own fork, on EASY only: the other
    // draws and the NORMAL / HARD plans stay as they are.
    if (this.difficulty !== 'easy' || !c.hold) return { waves };
    const lanes = c.lanes ?? 4;
    const base = r.int(1, lanes);
    const gangNo = ++this.gangs;
    const after = gang(r, c.tier ?? 0, 'behind', ['', ''], 44).map((m, index) => ({
      id: m.id,
      from: 'behind',
      dx: m.dx,
      lane: Math.max(1, Math.min(lanes, base + m.lane)),
      params: { ...m.params, gang: gangNo, size: 2, index },
    }));
    return { waves, after };
  }

  private jamWaves(r: Rng, c: WorkChunk): Record<string, unknown>[][] {
    const keep = (row: WaveRow): boolean => row === '' || (row === 'N' && this.difficulty !== 'easy') || (row === 'H' && this.difficulty === 'hard');
    const members = gang(r, c.tier ?? 0, 'behind', ['', '', 'N', 'H'], 28);
    const lanes = c.lanes ?? 4;
    const base = r.int(1, lanes);
    const gangNo = ++this.gangs;
    const kept = members.filter((m) => keep(m.row));
    const wave = kept.map((m, index) => ({
      id: m.id,
      from: 'behind',
      dx: m.dx,
      lane: Math.max(1, Math.min(lanes, base + m.lane)),
      params: { ...m.params, gang: gangNo, size: kept.length, index },
    }));
    const waves: Record<string, unknown>[][] = wave.length ? [wave] : [];
    if (this.wave !== 'B') return waves;
    // Wave B: the foot boarders after the gang (spec §7.2: ams handhavers and stag partiers run
    // between the stopped cars and hop onto a bonnet). The CREW builder's table; the looks swap
    // now and then (a draw on every difficulty, so the other draws stay the same).
    const swap = r.chance(0.5);
    const look = (a: 'handhaver' | 'stag'): string => (swap ? (a === 'stag' ? 'handhaver' : 'stag') : a);
    const rows: readonly (readonly [WaveRow, 'ahead' | 'behind', number, number, 'handhaver' | 'stag'])[] = [
      ['', 'ahead', 0, 2, 'handhaver'],
      ['', 'ahead', 40, 3, 'stag'],
      ['N', 'behind', 0, 3, 'stag'],
      ['H', 'ahead', 80, 1, 'handhaver'],
    ];
    const boarders = rows
      .filter(([row]) => keep(row))
      .map(([, from, dx, lane, kind], index) => ({
        id: RING_ENTITY_B_PARTS.boarder,
        from,
        dx,
        lane: Math.max(1, Math.min(lanes, lane)),
        params: { look: look(kind), index },
      }));
    if (boarders.length) waves.push(boarders);
    return waves;
  }

  private eligible(c: WorkChunk): boolean {
    // Revision R: the tail (the truck brings its own adds; then the final jam) holds no plan waves.
    return !c.scene && c.type !== 'rest' && !c.tail;
  }

  private enemies(rng: Rng): void {
    const P = RING_PLAN;
    let bank = 0;
    let cover = 0;
    let lastWave = -1e9;
    // The hostage carriers (placed before the waves) are enemies on screen too: their estimate
    // counts toward the 4-second floor (no forced wave on top of a hostage van).
    const carriers = this.spawns
      .filter((s) => s.params?.hostage && presenceOf(s) !== undefined)
      .map((s) => [appearTicks(this.chunks, s), appearTicks(this.chunks, s) + (presenceOf(s) ?? 0)] as const)
      .sort((a, b) => a[0] - b[0]);
    let ci = 0;
    let nextT = this.chooseWave(rng, 0, 'cruise');
    // Boss slots that got their wave right after the fight (see below).
    const bossWaved = new Set<RingBossSlot>();
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const cEnd = c.start + c.length;
      if (!this.eligible(c)) {
        // A rest or a scene: the estimate starts afresh at its end (integrator, wave B: a convoy
        // or a van shot during the rest left 4-7 s without an enemy after it when its estimate
        // carried over), so the next wave comes `gapPlace` ticks after it at the latest.
        cover = planTicksAt(this.chunks, cEnd);
        continue;
      }
      const rule = CHUNK_RULES[c.type];
      bank = Math.min(P.bankMax, bank + ((c.budget ?? 0) * P.threat * c.length) / CHUNK_LEN - rule.cost);
      // A boss slot: no voluntary wave before it (in wave B the boss comes first).
      const boss = this.bosses.find((b) => b.at >= c.start && b.at < cEnd);
      const calmUntil = boss ? boss.at + 32 : c.start;
      // The chunk's own template (wave B types) at its start.
      const fixed = this.wave === 'B' ? fixedTemplateOf(c.type) : null;
      if (fixed) {
        cover = Math.max(cover, this.placeWave(rng, fixed, c.start + 32, c));
        lastWave = c.start + 32;
      }
      const quietFrom = this.quietFrom(i);
      // A jam: its own wave covers the stand (the jam controller's `waves`); the gangs it has
      // on the road stay long (the stopped cars are cover), so only the 4-second floor (at
      // `gapJam`) and no voluntary waves (else the crawl fills with gangs).
      const jam = c.type === 'jam';
      const standAt = jam && c.hold && c.holdAt !== undefined ? c.start + c.holdAt : Infinity;
      const place = jam ? P.gapJam : Math.min(this.short ? P.short.gapPlace : P.gapPlace, P.gapTicks - P.gapMargin);
      for (let s = c.start; s < cEnd; s += 32) {
        // The stand's own wave covers the stand only (it is often shot fast): the crawl after it
        // gets the floor again. (`planTicksAt` at `holdAt` is the stand's end: it counts the hold.)
        if (s + 32 > standAt) cover = Math.max(cover, planTicksAt(this.chunks, standAt));
        const tNext = planTicksAt(this.chunks, s + 32);
        while (ci < carriers.length && carriers[ci][0] <= tNext) cover = Math.max(cover, carriers[ci++][1]);
        // Right after a boss slot's fight a wave rolls in (review B: the plan is locked at the
        // slot during the fight, and in 2P the next wave came 260 ticks after the lorry died).
        // (Only a boss that locks the plan: the end slot is a marker until the end boss exists.)
        const afterBoss = boss !== undefined && boss.id !== END_BOSS_MARKER && !bossWaved.has(boss) && s >= calmUntil;
        if (afterBoss) bossWaved.add(boss);
        const forced = afterBoss || tNext - cover > place;
        const voluntary = !jam && bank >= nextT.cost && s - lastWave >= P.waveSpacing && s < quietFrom && s >= calmUntil;
        if (!forced && !voluntary) continue;
        // In a jam and in the chunk after it the traffic still queues: only the scooter gangs
        // filter between the stopped cars (integrator, wave B: a moto pair from behind waited off
        // screen behind the queue for 5-6 s).
        const queue = jam || this.chunks[i - 1]?.type === 'jam';
        if (queue && !nextT.id.startsWith('gang-')) nextT = this.chooseWave(rng, c.tier ?? 0, c.type, true);
        cover = Math.max(cover, this.placeWave(rng, nextT, s, c));
        // The 4-second floor is free; the budget buys the threat above it.
        if (voluntary) bank -= nextT.cost;
        lastWave = s;
        nextT = this.chooseWave(rng, c.tier ?? 0, c.type);
      }
    }
  }

  /** Voluntary waves stop `quietBefore` px before a rest or a scene that follows chunk i. */
  private quietFrom(i: number): number {
    const c = this.chunks[i];
    const n = this.chunks[i + 1];
    const end = c.start + c.length;
    return n && !this.eligible(n) ? end - RING_PLAN.quietBefore : end;
  }

  private chooseWave(rng: Rng, tier: number, type: RingChunkType, gangsOnly = false): WaveTemplate {
    const list: WaveTemplate[] = [];
    const weights: number[] = [];
    for (const t of WAVE_TEMPLATES) {
      if (t.only || t.minTier > tier || (gangsOnly && !t.id.startsWith('gang-'))) continue;
      if (t.wave === 'B' && this.wave !== 'B') continue;
      list.push(t);
      weights.push(t.weight[tier] * (t.prefer?.types.includes(type) ? t.prefer.weight : 1));
    }
    const i = rng.weighted(weights);
    return i < 0 ? TEMPLATE_BY_ID.get('gang-behind')! : list[i];
  }

  /**
   * Place a wave at view spot `s` (the view's left edge). Returns the view tick until which its
   * base members are estimated on screen.
   */
  private placeWave(rng: Rng, t: WaveTemplate, s: number, c: WorkChunk): number {
    const members = t.build(rng, c.tier ?? 0);
    const gangNo = ++this.gangs;
    // The base lane: a random open lane at the spot.
    const open = this.openLanes(s + VIEW_W / 2);
    const base = open.length ? rng.pick(open) : 2;
    let cover = 0;
    // Every member appears while the view is still in the wave's chunk (never in a rest after it).
    const room = Math.max(0, c.start + c.length - 8 - s);
    for (const m of members) {
      let side = m.side;
      const dx = Math.min(m.dx, room);
      let at = side === 'behind' ? s + dx : s + AHEAD + dx;
      // Ahead of the plan end, or into a rest / scene: they come from behind instead.
      if (side !== 'behind') {
        const into = at < this.d ? this.chunkAt(at) : null;
        if (!into || !this.eligible(into)) {
          side = 'behind';
          at = s + dx;
        }
      }
      // A 'behind' member enters at the view's left edge (`at - spawnBehind`), a road member at `at`.
      const lanes = this.openLanes(side === 'behind' ? at - RING.spawnBehind : at);
      let lane = m.fixedLane ? m.lane : base + m.lane;
      if (!lanes.includes(lane)) lane = nearest(lanes, lane);
      const params: Record<string, unknown> = { ...m.params, side, gang: gangNo };
      this.spawns.push({ at, id: m.id, lane, from: side === 'behind' ? 'behind' : 'road', params, row: m.row, gang: gangNo });
      if (m.row === '') {
        const appear = side === 'behind' ? at : at - AHEAD;
        cover = Math.max(cover, planTicksAt(this.chunks, appear) + (ENEMY_PRESENCE[m.id] ?? 0));
      }
    }
    return cover;
  }

  // ------------------------------------------------------------------------------- items

  private items(rng: Rng): void {
    const P = RING_PLAN;
    let lastRepair = 0;
    let lastWeapon = -1e9;
    // Hostage drops count as repair chances.
    const repairs = this.spawns
      .filter((s) => s.params?.hostage && s.params.item === 'repair')
      .map((s) => planTicksAt(this.chunks, s.from === 'behind' ? s.at : s.at - AHEAD))
      .sort((a, b) => a - b);
    let ri = 0;
    let restDone = -1;
    for (let s = 0; s < this.d - AHEAD; s += 64) {
      const t = planTicksAt(this.chunks, s);
      while (ri < repairs.length && repairs[ri] <= t) lastRepair = Math.max(lastRepair, repairs[ri++]);
      const ci = chunkIndexAt(this.chunks, s + AHEAD);
      const c = this.chunks[ci];
      if (!c || c.scene || c.tail) continue;
      if (c.part === 'on-ramp' && lastWeapon < 0) {
        this.crate(rng, s, this.weaponKind(rng));
        lastWeapon = t;
        continue;
      }
      // A rest's crates lie in its middle (picked up during the rest).
      if (c.type === 'rest' && restDone !== ci && s + AHEAD >= c.start + c.length * 0.35) {
        restDone = ci;
        const kind = t - lastRepair >= P.repairRest ? 'repair' : (['weapon', 'bombs', 'repair'] as const)[rng.weighted([2, 1, 1])];
        const k = kind === 'weapon' ? this.weaponKind(rng) : kind;
        this.crate(rng, s, k);
        if (k === 'repair') lastRepair = t;
        else if (k !== 'bombs') lastWeapon = t;
        if (rng.chance(0.5)) this.crate(rng, s + 80, TREATS[rng.weighted(TREAT_WEIGHTS)]);
        continue;
      }
      if (t - lastRepair >= P.repairSoon) {
        this.crate(rng, s, 'repair');
        lastRepair = t;
      } else if (t - lastWeapon >= P.weaponTicks) {
        this.crate(rng, s, this.weaponKind(rng));
        lastWeapon = t;
      }
    }
  }

  private weaponKind(rng: Rng): string {
    return RING_WEAPON_KINDS[rng.weighted(WEAPON_WEIGHTS)];
  }

  /** A crate on the road, appearing when the view's left edge reaches `s`. */
  private crate(rng: Rng, s: number, kind: string): number {
    const at = s + AHEAD + rng.int(0, 2) * 16;
    const lanes = this.openLanes(at);
    const lane = rng.pick(lanes.length ? lanes : [2]);
    this.add({ at, id: RING_ENTITY.crate, lane, params: { kind } });
    return at;
  }

  // ------------------------------------------------------------------------------- golden

  private placeGolden(rng: Rng): void {
    // Mid-ring (zuid … coentunnel), in a plain chunk, on the far lane when it is open.
    // The short route (revision R): in amstel or zuid.
    const ids: RingLandmarkId[] = this.short ? ['amstel', 'zuid'] : ['zuid', 'nieuwe-meer', 'west', 'westpoort', 'coentunnel', 'noord'];
    const id = rng.pick(ids);
    const st = this.stretchRange(id);
    const spots: number[] = [];
    for (const c of this.chunks) {
      if (c.stretch !== id || c.setPiece || !(c.type === 'cruise' || c.type === 'traffic' || c.type === 'speedcam') || c.part === 'run-in') continue;
      for (let x = c.start + 64; x < c.start + c.length - 64; x += 32) spots.push(x);
    }
    const at = spots.length ? rng.pick(spots) : st.start + Math.floor((st.end - st.start) / 2);
    const lanes = this.openLanes(at);
    const lane = lanes.length ? lanes[0] : 1;
    this.add({ at, id: RING_ENTITY.crate, lane, params: { kind: 'golden-record' } });
    this.golden = at;
  }

  // ------------------------------------------------------------------------------- finish

  /** Apply the difficulty rows, number the gang members, sort by plan distance. */
  private finishSpawns(): RingSpawn[] {
    const keep = (row: WaveRow): boolean => row === '' || (row === 'N' && this.difficulty !== 'easy') || (row === 'H' && this.difficulty === 'hard');
    const kept = this.spawns.filter((s) => keep(s.row));
    const size = new Map<number, number>();
    for (const s of kept) if (s.gang !== undefined) size.set(s.gang, (size.get(s.gang) ?? 0) + 1);
    const index = new Map<number, number>();
    const out: RingSpawn[] = kept.map((s) => {
      const params = s.params ? { ...s.params } : undefined;
      if (s.gang !== undefined && params) {
        const k = index.get(s.gang) ?? 0;
        index.set(s.gang, k + 1);
        params.size = size.get(s.gang);
        params.index = k;
      }
      const e: { -readonly [K in keyof RingSpawn]: RingSpawn[K] } = { at: Math.round(s.at), id: s.id };
      if (s.lane !== undefined) e.lane = s.lane;
      if (s.y !== undefined) e.y = s.y;
      if (s.from === 'behind') e.from = 'behind';
      if (params) e.params = params;
      return e;
    });
    out.sort((a, b) => a.at - b.at);
    return out;
  }
}

/** Lane closures by tier: the edge lanes first, two lanes only later (always lanes left open). */
const CLOSE_LOW: readonly (readonly number[])[] = [[1], [4]];
const CLOSE_MID: readonly (readonly number[])[] = [[1], [4], [3, 4]];
const CLOSE_HIGH: readonly (readonly number[])[] = [[1], [4], [3, 4], [1, 2]];

/** The lane of `lanes` nearest to `l`. */
function nearest(lanes: readonly number[], l: number): number {
  let best = lanes[0] ?? 2;
  for (const x of lanes) if (Math.abs(x - l) < Math.abs(best - l)) best = x;
  return best;
}

// =============================================================================================
// Plan-level estimates (the invariants; the integrator checks them in game)
// =============================================================================================

/** View tick at which a spawn appears (a 'behind' entry at `at`, a road entry at `at - AHEAD`). */
export function appearTicks(chunks: readonly RingChunk[], s: Pick<RingSpawn, 'at' | 'from'>): number {
  return planTicksAt(chunks, s.from === 'behind' ? s.at : s.at - AHEAD);
}

/** A span of planned ticks. */
export interface TickGap {
  readonly from: number;
  readonly to: number;
  readonly ticks: number;
}

/**
 * The 4-second estimate (GDD §1.5 rule 1): spans of planned ticks longer than `limit` with no
 * enemy estimated on screen (each enemy counts `ENEMY_PRESENCE` ticks from its appearance),
 * outside rests and scenes. Empty for every generated plan.
 */
export function enemyGaps(plan: { readonly chunks: readonly RingChunk[]; readonly spawns: readonly RingSpawn[] }, limit = RING_PLAN.gapTicks): TickGap[] {
  const chunks = plan.chunks;
  const covers: [number, number][] = [];
  for (const s of plan.spawns) {
    // A jam's own wave (its `waves` param) comes at its stand and stays through it.
    if (s.id === RING_ENTITY.jam) {
      const jp = s.params as { hold?: number; holdAt?: number; waves?: unknown[] } | undefined;
      if (jp?.waves?.length && jp.hold) {
        // `planTicksAt` at `holdAt` is the stand's end (it counts the hold).
        const end = planTicksAt(chunks, s.at + (jp.holdAt ?? 0));
        covers.push([end - jp.hold, end + (ENEMY_PRESENCE[RING_ENTITY.scooter] ?? 0)]);
      }
      continue;
    }
    const p = presenceOf(s);
    if (p === undefined) continue;
    const t = appearTicks(chunks, s);
    covers.push([t, t + p]);
  }
  covers.sort((a, b) => a[0] - b[0]);
  const gaps: TickGap[] = [];
  const cum = cumTicks(chunks);
  let ci = 0;
  let reach = -Infinity;
  for (let i = 0; i < chunks.length; ) {
    const c = chunks[i];
    if (c.scene || c.tail || c.type === 'rest') {
      i++;
      continue;
    }
    // An eligible run [r0, r1] of planned ticks.
    let j = i;
    while (j < chunks.length && !chunks[j].scene && !chunks[j].tail && chunks[j].type !== 'rest') j++;
    const r0 = cum[i];
    const r1 = cum[j];
    let at = r0;
    while (at < r1) {
      while (ci < covers.length && covers[ci][0] <= at) reach = Math.max(reach, covers[ci++][1]);
      if (reach > at) {
        at = reach;
        continue;
      }
      const nextStart = ci < covers.length ? Math.min(covers[ci][0], r1) : r1;
      if (nextStart - at > limit) gaps.push({ from: Math.round(at), to: Math.round(nextStart), ticks: Math.round(nextStart - at) });
      at = nextStart;
      if (at >= r1) break;
    }
    i = j;
  }
  return gaps;
}

/** Is a spawn a repair chance (a repair crate, or a hostage that drops a repair)? */
export function isRepairChance(s: RingSpawn): boolean {
  const p = s.params as { kind?: unknown; hostage?: unknown; item?: unknown } | undefined;
  if (!p) return false;
  return (s.id === RING_ENTITY.crate && p.kind === 'repair') || (p.hostage === true && p.item === 'repair');
}

/** Spans (planned ticks) between repair chances, from the start to the end of the ring. */
export function repairGaps(plan: { readonly chunks: readonly RingChunk[]; readonly spawns: readonly RingSpawn[] }): TickGap[] {
  const times = plan.spawns.filter(isRepairChance).map((s) => appearTicks(plan.chunks, s));
  times.sort((a, b) => a - b);
  const end = totalTicks(plan.chunks);
  const out: TickGap[] = [];
  let prev = 0;
  for (const t of [...times, end]) {
    out.push({ from: Math.round(prev), to: Math.round(t), ticks: Math.round(t - prev) });
    prev = t;
  }
  return out;
}

/** Spans (planned ticks) between weapon crates (GDD §1.5 rule 3), from the start to the end. */
export function weaponGaps(plan: { readonly chunks: readonly RingChunk[]; readonly spawns: readonly RingSpawn[] }): TickGap[] {
  const times = plan.spawns
    .filter((s) => s.id === RING_ENTITY.crate && RING_WEAPON_KINDS.includes(String((s.params as { kind?: unknown } | undefined)?.kind)))
    .map((s) => appearTicks(plan.chunks, s));
  times.sort((a, b) => a - b);
  const end = totalTicks(plan.chunks);
  const out: TickGap[] = [];
  let prev = 0;
  for (const t of [...times, end]) {
    out.push({ from: Math.round(prev), to: Math.round(t), ticks: Math.round(t - prev) });
    prev = t;
  }
  return out;
}
