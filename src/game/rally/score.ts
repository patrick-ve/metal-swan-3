/**
 * The race's tally lines (docs/design/rally.md §9). WAVE A by PREP: PLACE and TIME. WAVE B by PREP
 * (the contract, docs/api/rally.md "B.5"; RULES owns the values and may tune them): BEST LAP,
 * OVERTAKES, NEAR MISSES, FINES (with the euros as a joke) and TEAM (2P), from the `ScoreBook` that
 * counts the runner's wave-B events. The shape stays (`raceLines(race, car)` → lines with points, or
 * null for a missed bonus); without a book the lines are wave A's (PLACE, TIME).
 *
 * The prize money (docs/design/budget.md §7.8, BUDGET): every line also carries its euros
 * (`cents`; the tally page shows and books them: mission-complete.ts): PLACE € 500 / 350 / 250 /
 * 150 / 100 / 75 / 50 / 25, TIME € 0,50 per second under par, BEST LAP € 50, OVERTAKES € 2 each,
 * NEAR MISSES € 1 each, FINES − € 120 each (the real red-light fine; the joke column goes), TEAM
 * (2P) € 100 each. The points stay as they were (the sims' `score`).
 */
import type { EventBus } from '../../engine/events';
import type { CarState, RallyEventsB } from './api';

/** One tally line (the shape of mission-complete.ts `TallyLine`). */
export interface RallyLine {
  label: string;
  points: number | null;
  note?: string;
  /** The prize money in cents (signed; null = missed). */
  cents?: number | null;
}

/** The prize money (docs/design/budget.md §7.8), in cents. */
export const PRIZE = {
  /** PLACE by place: 1st … 8th. */
  place: [50_000, 35_000, 25_000, 15_000, 10_000, 7_500, 5_000, 2_500] as readonly number[],
  /** TIME: per full second under par (€ 0,50). */
  timePerSecond: 50,
  bestLap: 5_000,
  overtake: 200,
  nearMiss: 100,
  /** Per fine (a cost: the real red-light fine). */
  fine: -12_000,
  team: 10_000,
} as const;

/** The PLACE prize of a place (a place past the table: the last; 0 = not placed). */
export function placeCents(place: number): number {
  return place >= 1 ? PRIZE.place[Math.min(place, PRIZE.place.length) - 1] : 0;
}

/** PLACE points by place (spec §9): 1st … 8th. */
export const PLACE_POINTS: readonly number[] = [20000, 15000, 12000, 9000, 7000, 5000, 3500, 2000];
/** TIME: points per full second under par. */
export const TIME_POINTS_PER_SECOND = 50;

/** m:ss.t of race ticks. */
export function raceClock(ticks: number): string {
  const t = Math.max(0, Math.round(ticks / 6));
  const tenths = t % 10;
  const s = Math.floor(t / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${tenths}`;
}

/** Wave B (spec §9; RULES may tune): BEST LAP for a lap under the lap par. */
export const BEST_LAP_POINTS = 2000;
/** Per overtake of a rival (once per rival per lap: the emitter checks it). */
export const OVERTAKE_POINTS = 100;
/** Per near miss with traffic above `NEAR_MISS_KMH`. */
export const NEAR_MISS_POINTS = 50;
export const NEAR_MISS_KMH = 150;
/** Per fine (the tally also shows the euros). */
export const FINE_POINTS = -250;
/** 2P: each player when both estates finish in the top `TEAM_TOP`. */
export const TEAM_POINTS = 5000;
export const TEAM_TOP = 3;

/**
 * RULES (wave B): the fines in euros — the joke column of the tally (spec §5, §9). A speed camera or
 * the average-speed zone: a base plus euros per km/h over the limit; a red X: a fixed amount. Our
 * own round numbers, not a real tariff.
 */
export const FINE_BASE = 50;
export const FINE_PER_KMH = 10;
export const REDX_EUROS = 250;

/** The euros of one fine (`over`: km/h above the limit; ignored for a red X). */
export function fineEuros(kind: 'camera' | 'zone' | 'redx', over: number): number {
  if (kind === 'redx') return REDX_EUROS;
  return FINE_BASE + FINE_PER_KMH * Math.max(0, Math.round(over));
}

/** The euros as the tally writes them: '8.430' (Dutch thousands). */
export function eurosText(e: number): string {
  const n = Math.max(0, Math.round(e));
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '.';
    out += s[i];
  }
  return out;
}

/** What the book counts for one car (by its id): the rivals too (the results, the police's choice). */
export interface CarTally {
  overtakes: number;
  nearMisses: number;
  /** The fines' euros (the count is `CarState.fines`). */
  finesEuros: number;
}

/**
 * The race's counters (wave B): it listens to the runner's `overtake`, `nearMiss` and `fine` events
 * (`listen`), so the emitters (FIELD, RULES) only emit. A car's entry is made on its first event.
 */
export class ScoreBook {
  private readonly cars = new Map<string, CarTally>();

  /** The tally of a car (made on first use). */
  tally(car: string): CarTally {
    let t = this.cars.get(car);
    if (!t) {
      t = { overtakes: 0, nearMisses: 0, finesEuros: 0 };
      this.cars.set(car, t);
    }
    return t;
  }

  /** The tally of a car, or null when nothing was counted for it. */
  peek(car: string): Readonly<CarTally> | null {
    return this.cars.get(car) ?? null;
  }

  overtake(car: string): void {
    this.tally(car).overtakes++;
  }

  /** A near miss (it counts only at `NEAR_MISS_KMH` or more). */
  nearMiss(car: string, kmh: number): void {
    if (kmh >= NEAR_MISS_KMH) this.tally(car).nearMisses++;
  }

  fine(car: string, euros: number): void {
    this.tally(car).finesEuros += euros;
  }

  /** Count the runner's events from now on; returns the unsubscribe. */
  listen<M extends Pick<RallyEventsB, 'overtake' | 'nearMiss' | 'fine'>>(events: EventBus<M>): () => void {
    const offs = [events.on('overtake', (e) => this.overtake(e.car)), events.on('nearMiss', (e) => this.nearMiss(e.car, e.speed)), events.on('fine', (e) => this.fine(e.car, e.euros))];
    return () => {
      for (const off of offs) off();
    };
  }

  clear(): void {
    this.cars.clear();
  }
}

/** A player's score by line (points; `finesEuros` the joke column), spec §9. */
export interface PlayerScore {
  place: number;
  timeBonus: number;
  bestLap: number;
  overtakes: number;
  nearMisses: number;
  /** ≤ 0 (never more than the other lines together: the total never goes below 0). */
  fines: number;
  finesEuros: number;
  team: number;
}

/** What `raceLines` reads. */
export interface ScoredRace {
  /** The par of the whole race (ticks: the par lap × the laps driven). */
  readonly parTicks: number;
  readonly carCount: number;
  /** Wave B (optional): the par lap (ticks) for BEST LAP; absent = no BEST LAP bonus. */
  readonly parLapTicks?: number;
  /** Wave B (optional): the race's counters; absent = wave A's lines only (PLACE, TIME). */
  readonly book?: ScoreBook;
  /** Wave B (optional): every car (the TEAM line looks for the other estate). */
  readonly cars?: readonly CarState[];
}

/** A player's score by line (spec §9); null for no car. */
export function playerScore(race: ScoredRace, car: CarState | null): PlayerScore | null {
  if (!car) return null;
  const place = car.place;
  const placePts = place >= 1 ? PLACE_POINTS[Math.min(place, PLACE_POINTS.length) - 1] : 0;
  const t = car.finishTicks;
  const under = t >= 0 ? Math.floor((race.parTicks - t) / 60) : 0;
  const timeBonus = under > 0 ? under * TIME_POINTS_PER_SECOND : 0;
  const best = bestLapTicks(car);
  const bestLap = race.parLapTicks !== undefined && best >= 0 && best < race.parLapTicks ? BEST_LAP_POINTS : 0;
  const tally = race.book?.peek(car.id) ?? null;
  const overtakes = (tally?.overtakes ?? 0) * OVERTAKE_POINTS;
  const nearMisses = (tally?.nearMisses ?? 0) * NEAR_MISS_POINTS;
  let team = 0;
  if (race.cars && car.slot >= 0 && car.finished && place <= TEAM_TOP) {
    let mates = 0;
    let top = 0;
    for (const c of race.cars) {
      if (c.slot < 0) continue;
      mates++;
      if (c.finished && c.place <= TEAM_TOP) top++;
    }
    if (mates >= 2 && top === mates) team = TEAM_POINTS;
  }
  const plus = placePts + timeBonus + bestLap + overtakes + nearMisses + team;
  const fines = Math.max(car.fines * FINE_POINTS, -plus);
  return { place: placePts, timeBonus, bestLap, overtakes, nearMisses, fines, finesEuros: tally?.finesEuros ?? 0, team };
}

/** The tally lines of a player's car (an unfinished car: PLACE by its place, no TIME bonus). */
export function raceLines(race: ScoredRace, car: CarState | null): RallyLine[] {
  if (!car) return [{ label: 'PLACE', points: null, note: '-', cents: null }];
  if (race.book) return scoreLines(race, car);
  const place = car.place;
  // A place past the table (a field of 9: a mid-race join after every rival finished) scores as the last.
  const pts = place >= 1 ? PLACE_POINTS[Math.min(place, PLACE_POINTS.length) - 1] : 0;
  const lines: RallyLine[] = [{ label: `PLACE ${place}/${race.carCount}`, points: pts, cents: placeCents(place) }];
  const t = car.finishTicks;
  const under = t >= 0 ? Math.floor((race.parTicks - t) / 60) : 0;
  lines.push({ label: `TIME ${t >= 0 ? raceClock(t) : '-'}`, points: under > 0 ? under * TIME_POINTS_PER_SECOND : null, cents: under > 0 ? under * PRIZE.timePerSecond : null });
  return lines;
}

/**
 * Wave B: every line of spec §9 (PLACE, TIME, BEST LAP, OVERTAKES, NEAR MISSES, FINES, and TEAM in
 * a race of two players). A missed bonus shows its count with null points.
 */
export function scoreLines(race: ScoredRace, car: CarState): RallyLine[] {
  const sc = playerScore(race, car)!;
  const tally = race.book?.peek(car.id) ?? null;
  const t = car.finishTicks;
  const best = bestLapTicks(car);
  const under = t >= 0 ? Math.floor((race.parTicks - t) / 60) : 0;
  const overtakes = tally?.overtakes ?? 0;
  const nearMisses = tally?.nearMisses ?? 0;
  // The prize money (docs/design/budget.md §7.8): every line in cents beside its points.
  const lines: RallyLine[] = [
    { label: `PLACE ${car.place}/${race.carCount}`, points: sc.place, cents: placeCents(car.place) },
    { label: `TIME ${t >= 0 ? raceClock(t) : '-'}`, points: sc.timeBonus > 0 ? sc.timeBonus : null, cents: under > 0 ? under * PRIZE.timePerSecond : null },
    { label: `BEST LAP ${best >= 0 ? raceClock(best) : '-'}`, points: sc.bestLap > 0 ? sc.bestLap : null, cents: sc.bestLap > 0 ? PRIZE.bestLap : null },
    { label: `OVERTAKES ${overtakes}`, points: sc.overtakes > 0 ? sc.overtakes : null, cents: overtakes > 0 ? overtakes * PRIZE.overtake : null },
    { label: `NEAR MISSES ${nearMisses}`, points: sc.nearMisses > 0 ? sc.nearMisses : null, cents: nearMisses > 0 ? nearMisses * PRIZE.nearMiss : null },
    { label: `FINES ${car.fines}`, points: sc.fines < 0 ? sc.fines : null, cents: car.fines > 0 ? car.fines * PRIZE.fine : null },
  ];
  let players = 0;
  for (const c of race.cars ?? []) if (c.slot >= 0) players++;
  if (players >= 2) lines.push({ label: 'TEAM', points: sc.team > 0 ? sc.team : null, cents: sc.team > 0 ? PRIZE.team : null });
  return lines;
}

/** THE CRITICS SAY by place: 1st 5 stars, 2nd–3rd 4, 4th–5th 3, 6th–7th 2, else 1. */
export function raceStars(car: CarState | null): number {
  const p = car?.place ?? 99;
  return p <= 1 ? 5 : p <= 3 ? 4 : p <= 5 ? 3 : p <= 7 ? 2 : 1;
}

/** The car's best full lap (race ticks; −1 = none yet). A partial lap (`partLaps`: a mid-race join) is no lap record. */
export function bestLapTicks(car: CarState): number {
  let b = -1;
  for (let k = car.partLaps; k < car.lapTicks.length; k++) {
    const t = car.lapTicks[k];
    if (b < 0 || t < b) b = t;
  }
  return b;
}

/** The sum of the lines' prize money (cents, signed). */
export function linesCents(lines: readonly RallyLine[]): number {
  let n = 0;
  for (const l of lines) n += l.cents ?? 0;
  return n;
}

/** The sum of the lines' points. */
export function linesTotal(lines: readonly RallyLine[]): number {
  let n = 0;
  for (const l of lines) n += l.points ?? 0;
  return n;
}
