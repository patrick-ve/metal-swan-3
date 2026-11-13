/**
 * The rats of mission `sewers` (docs/design/sewers.md §3, §5.1; wave P1a RATS). LAZY: manifest id
 * `sewers/rats` (content/index.ts `isSewersContent`); gameplay and the stand-in sprites register at
 * import time (`art.ts`; every sprite id carries the `sewers-` segment, so the art worker loads this
 * chunk for it).
 *
 * | id | HP | € | params |
 * |---|---|---|---|
 * | `sewers-rat-runner` | 10 | 2 | `entry` (`left` \| `right` \| `hole` \| `drop`), `delay`, `gag`, `facing` |
 * | `sewers-rat-leaper` | 10 | 3 | `entry` (`pipe` \| `grate`; the others run at once), `delay`, `facing` |
 * | `sewers-rat-spitter` | 20 | 4 | `other` (second plinth x), `hop`, `entry`, `delay`, `facing` |
 * | `sewers-rat-brute` | 120 | 15 | `entry`, `delay`, `facing` |
 *
 * Helpers for the section builders: `ratPack(ctx, n, entry)`, `spitterPlinths(t, x)` (helpers.ts).
 * The light: `isLit` in `../light-test.ts` (a stub until wave C).
 */
import './art';
import './runner';
import './leaper';
import './spitter';
import './brute';

export { Rat, type RatEntry } from './base';
export { RunnerRat } from './runner';
export { LeaperRat } from './leaper';
export { SpitterRat, lobAim } from './spitter';
export { BruteRat } from './brute';
export { ratPack, spitterPlinths, type RatPackEntry } from './helpers';
export { BRUTE, LEAPER, PLINTH, RAT, RAT_ART, RUNNER, SPITTER } from './numbers';
