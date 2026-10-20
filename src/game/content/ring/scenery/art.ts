/**
 * Sprites and background generators of content area `ring/scenery` (docs/design/ring.md §11;
 * docs/ART_GUIDE.md "UHD art": 1× art in the 64-colour PAL and 2× / 4× from ONE density-generic
 * drawer per id, kit.ts `Pen`). Owner: the SCENERY builder.
 *
 * - Background generators (`ring-*`, art-registry): `ring-sky`, `ring-far`, `ring-city`
 *   (layers-far.ts), `ring-verge`, `ring-farroad`, `ring-tunnel`, `ring-road`, `ring-front`
 *   (layers-near.ts); each with its 2× and 4× version.
 * - Sprites (pieces.ts): the set pieces `decor/ring/<landmark>/…`, the road furniture
 *   `decor/ring/road/…` (median lamp posts, oncoming cars) and the light sprites `fx/ring/light/…`.
 */
import './layers-far';
import './layers-near';
import './pieces';
