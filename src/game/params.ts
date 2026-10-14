/**
 * URL launch parameters (docs/ARCHITECTURE.md §5.13):
 * `?mission=m1&section=b&god=1&debug=1&seed=42&players=2&char=<id>&weapon=<id>&boss=1&mute=1`
 * plus `difficulty=easy|normal|hard`, `gfx=pixel|smooth|xbr` (the GRAPHICS filter for this
 * session; not saved; the older spelling `res=` is still read) and `kmax=1..12` (highest
 * backbuffer resolution; a perf / debug knob). Pure parsing (main.ts passes `location.search`).
 * With `mission` set the game skips the title and starts that mission at once.
 */
import type { UpscaleMode } from '../engine/upscale';
import { isDifficulty, type Difficulty } from './session';
import { isGraphicsMode } from './settings';

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
  /** GRAPHICS filter for this session (overrides the saved option until it is changed). */
  gfx: UpscaleMode | null;
  /** Highest backbuffer resolution (default KMAX in render-common.ts; 1 = the classic 384×216). */
  kmax: number | null;
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
  gfx: null,
  kmax: null,
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
  const gfx = (q.get('gfx') ?? q.get('res'))?.toLowerCase() ?? null;
  const kmaxRaw = q.get('kmax');
  const kmax = kmaxRaw !== null && /^\d{1,2}$/.test(kmaxRaw) && Number(kmaxRaw) >= 1 && Number(kmaxRaw) <= 12 ? Number(kmaxRaw) : null;
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
    gfx: isGraphicsMode(gfx) ? gfx : null,
    kmax,
  };
}
