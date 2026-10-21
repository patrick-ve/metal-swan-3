/**
 * Content area `ring/crew` (docs/design/ring.md §5.5, §7.2; docs/api/ring.md "Wave B: the crew").
 * Owner: the CREW builder.
 *
 * - `ring-roadworks` (roadworks.ts): the road-works truck with the arrow trailer, its crew
 *   (`ring-roadworker`) that lobs cones (`RingConeLob`), and the cones it drops behind it
 *   (`RingConeLine`: the closed lane).
 * - `ring-boarder` (boarder.ts): the jam boarders (ams handhavers and stag partiers) that hop onto a
 *   wagon's bonnet in a standing jam.
 * Sprites: art.ts (`ring/roadworks/`, `ring/boarder/`). Sounds: content/sfx/ring-crew.ts.
 *
 * Tier-4 art families (art-def.ts): `ring-roadworks` → `ring/roadworks/` (wave A's map) and
 * `ring-boarder` → `ring/boarder/`. The boarders come from a jam's `waves` param, not from plan
 * spawns, so the jam's stretches carry the boarder family too (`ring-jam` → the hazards and
 * `ring/boarder/`).
 */
import { defineRingArt } from '../../../ring/art-def';
import { RING_ART, RING_ENTITY, RING_ENTITY_B } from '../../../ring/ids';
import { RING_BOARDER } from './boarder';

export { BOARDER, RING_BOARDER, RingBoarder, type BoarderMode } from './boarder';
export { RING_ROADWORKER, ROADWORKS, RingConeLine, RingConeLob, RingRoadworker, RingRoadworks, type ConeLobOpts, type RoadworksMode, type WorkerMode } from './roadworks';

defineRingArt(RING_ENTITY_B.roadworks, ['ring/roadworks/']);
defineRingArt(RING_BOARDER, ['ring/boarder/']);
defineRingArt(RING_ENTITY.jam, [RING_ART.hazard, 'ring/boarder/']);
