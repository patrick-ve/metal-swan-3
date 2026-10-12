/**
 * URL launch parameters (docs/ARCHITECTURE.md §5.13):
 * `?mission=m1&section=b&god=1&debug=1&seed=42&players=2&char=<id>&weapon=<id>&boss=1&mute=1`
 * plus `difficulty=easy|normal|hard`. Pure parsing (main.ts passes `location.search`).
 * With `mission` set the game skips the title and starts that mission at once.
 */
import { isDifficulty, type Difficulty } from './session';

export interface LaunchParams {
  mission: string | null;
  section: string | null;
  god: boolean;
  debug: boolean;
  seed: number | null;
  players: 1 | 2;
  char: string | null;
  weapon: string | null;
  boss: boolean;
  mute: boolean;
  difficulty: Difficulty | null;
}

export const DEFAULT_PARAMS: Readonly<LaunchParams> = Object.freeze({
  mission: null,
  section: null,
  god: false,
  debug: false,
  seed: null,
  players: 1,
  char: null,
  weapon: null,
  boss: false,
  mute: false,
  difficulty: null,
});

/** Ids are short kebab-case words; anything else is ignored. */
function id(v: string | null): string | null {
  return v && /^[a-z0-9][a-z0-9_/-]{0,39}$/i.test(v) ? v : null;
}

function flag(v: string | null): boolean {
  return v !== null && v !== '0' && v.toLowerCase() !== 'false' && v.toLowerCase() !== 'no';
}

export function parseLaunchParams(search: string): LaunchParams {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const seedRaw = q.get('seed');
  const seed = seedRaw !== null && /^-?\d{1,10}$/.test(seedRaw) ? Number(seedRaw) >>> 0 : null;
  const diff = q.get('difficulty');
  return {
    mission: id(q.get('mission')),
    section: id(q.get('section')),
    god: flag(q.get('god')),
    debug: flag(q.get('debug')),
    seed,
    players: q.get('players') === '2' ? 2 : 1,
    char: id(q.get('char')),
    weapon: id(q.get('weapon')),
    boss: flag(q.get('boss')),
    mute: flag(q.get('mute')),
    difficulty: isDifficulty(diff) ? diff : null,
  };
}
