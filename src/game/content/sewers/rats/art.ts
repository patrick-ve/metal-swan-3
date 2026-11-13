/**
 * The art of the four rats and the spitter's slime (docs/design/sewers.md §3): baked 40 px sets
 * (wave P5 RATS; drawn offline by tools/art40/chars/sewers-rat-{runner,leaper,spitter,brute,slime}/
 * with the shared rat rig, `npm run art40 -- <slug> --out src/game/content/sewers/art40`). They live
 * in the lazy sewers chunk (this module is imported by `rats/index.ts`), never in the boot set. One
 * 1× picture at every art tier (plan rule 7).
 *
 * Every rat: `<art>/{idle,run,tell,bite,recover,fall,rise,gloat,cower,die,die-crush,die-blast,eyes}`
 * (+ leaper `lurk`, `lurk-tell`, `jump`; spitter `spit`, `hop`; brute `walk`, `charge`, `rear`,
 * `stomp`). Anchor: the feet centre (`lurk` / `lurk-tell`: the pipe mouth, the head on it). Point
 * `eye` on every frame: where the eyes-only state draws `<art>/eyes` (frame 0 the red pair, frame 1
 * the white tell flash: a star on each eye, 13 × 7 px, the brute's 17 × 9, so the tell reads at 1× in
 * the dark). Frame counts the code reads by index are kept: the spitter's `tell` 3 (once at tele/3 a
 * frame), `spit` 2 (once(0, 7)), the runner's `bite` 2 and the brute's `stomp` 2 (once(0, 4 / 8)),
 * the eyes 2; the other strips run on the set's own timing or on the code's looping(n) ticks.
 * The slime: `fx/sewers-rat-slime/blob` (centre), `…/splat` (4 frames, 12 ticks), `…/puddle` (feet).
 */
import type { Color } from '../../../../engine/color';
import { defineBakedSet } from '../../../../engine/baked';
import { PAL } from '../../../../engine/palette';
import { SET as BRUTE } from '../art40/sewers-rat-brute.gen';
import { SET as LEAPER } from '../art40/sewers-rat-leaper.gen';
import { SET as RUNNER } from '../art40/sewers-rat-runner.gen';
import { SET as SLIME } from '../art40/sewers-rat-slime.gen';
import { SET as SPITTER } from '../art40/sewers-rat-spitter.gen';

defineBakedSet(RUNNER);
defineBakedSet(LEAPER);
defineBakedSet(SPITTER);
defineBakedSet(BRUTE);
defineBakedSet(SLIME);

/** The green slime colours (defeats, splats: the particle chunks). */
export const SLIME_COLORS: readonly Color[] = [PAL.green[1], PAL.green[2], PAL.green[3]];
