/**
 * Sprites of mission sewers' two hostage looks (docs/design/sewers.md §3; owner P5 STREET): baked 40
 * px sets (drawn offline by tools/art40/chars/sewers-street/hostages.py with the tied tourist's
 * animation code, `npm run art40 -- sewers-banana --out src/game/content/sewers/art40`), loaded with
 * the lazy sewers chunk only:
 *
 * - `item/hostage/sewers-worker/…`: the sewer worker, orange overalls with reflective bands, the yellow
 *   helmet with its dead head-lamp, tangled in wet wipes (the coils on the chair and the mast);
 * - `item/hostage/sewers-banana/…`: the stag-party tourist in a banana costume (a look of the tourist).
 *
 * Strips: `tied` (on the folding chair: the worker 3 frames rest / blink / struggle, the plain
 * struggle bind; the banana tourist the tourist's 8 frame roles, items/hostage.art.ts TIED_*), `mast`
 * (the same frames, standing), `sack` 8 (the hop), `freed` 8 (20 ticks; the banana waves), `walk` 12,
 * `run` 12, `gag` (the worker 4: the kind picks frames 0-1 for line 1, he taps his dead lamp, and 2-3
 * for line 2; the banana 8 frames over 40 ticks, the phone flash at tick 24 = the tourist's
 * GAG_FLASH_TICK, point `flash`), `give` 6 (24 ticks, point `hand`: the gift at tick 12 from the old
 * handover point), `bow` 6 (12 ticks). No `caged` strip (a cage falls back to `tied`) and no `turn`
 * strip (they stay plain hostages).
 */
import { defineBakedSet } from '../../../../engine/baked';
import { SET as BANANA } from '../art40/sewers-banana.gen';
import { SET as WORKER } from '../art40/sewers-worker.gen';

export const WORKER_ART = 'item/hostage/sewers-worker';
export const BANANA_ART = 'item/hostage/sewers-banana';

defineBakedSet(WORKER);
defineBakedSet(BANANA);
