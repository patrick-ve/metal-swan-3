/**
 * The pink boat's sprites (wave B; docs/design/ring.md §R.7): `boss/ring-boot/…` — the body
 * (art-hull.ts: the trailer, the hull and its damage states, the deck, the mast with the bunting
 * and the streamer, the boom, the loudspeakers, the deferred end strips), the crew (art-crew.ts: the
 * leader on deck and as the NPC after the end, the drum band and its drums) and the effects
 * (art-fx.ts: the paint balloons and splats, the ground shock, the megaphone rings). Every id: 1× art
 * (PAL) and 2× / 4× from one density-generic drawer (PAL_HD), geometry as at 1×.
 *
 * OWNER: BLOCKADE+BOAT. The content manifest entry `ring/boot/art` loads it; boot/index.ts imports
 * it too.
 */
import './art-hull';
import './art-crew';
import './art-fx';
