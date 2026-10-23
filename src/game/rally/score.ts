/**
 * The race's tally lines — WAVE A by PREP (docs/design/rally.md §9): PLACE and TIME. RULES (wave B)
 * adds BEST LAP, OVERTAKES, NEAR MISSES, FINES and TEAM and may tune the values; the shape stays
 * (`raceLines(runner, slot)` → lines with points, or null for a missed bonus).
 */
import type { CarState } from './api';

/** One tally line (the shape of mission-complete.ts `TallyLine`). */
export interface RallyLine {
  label: string;
  points: number | null;
  note?: string;
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

/** What `raceLines` reads. */
export interface ScoredRace {
  /** The par of the whole race (ticks: the par lap × the laps driven). */
  readonly parTicks: number;
  readonly carCount: number;
}

/** The tally lines of a player's car (an unfinished car: PLACE by its place, no TIME bonus). */
export function raceLines(race: ScoredRace, car: CarState | null): RallyLine[] {
  if (!car) return [{ label: 'PLACE', points: null, note: '-' }];
  const place = car.place;
  // A place past the table (a field of 9: a mid-race join after every rival finished) scores as the last.
  const pts = place >= 1 ? PLACE_POINTS[Math.min(place, PLACE_POINTS.length) - 1] : 0;
  const lines: RallyLine[] = [{ label: `PLACE ${place}/${race.carCount}`, points: pts }];
  const t = car.finishTicks;
  const under = t >= 0 ? Math.floor((race.parTicks - t) / 60) : 0;
  lines.push({ label: `TIME ${t >= 0 ? raceClock(t) : '-'}`, points: under > 0 ? under * TIME_POINTS_PER_SECOND : null });
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

/** The sum of the lines' points. */
export function linesTotal(lines: readonly RallyLine[]): number {
  let n = 0;
  for (const l of lines) n += l.points ?? 0;
  return n;
}
