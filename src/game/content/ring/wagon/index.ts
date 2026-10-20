/**
 * Content area `ring/wagon` (docs/design/ring.md §3, §9, §10; docs/api/ring.md §5). Owner: the
 * WAGON builder. The two squad wagons (art.ts / art-hd.ts: 1×, 2×, 4×), the drivers' lines
 * (lines.ts), the lob (lob.ts: `ring-lob`), the boarding scene and the exit (src/game/ring/
 * boarding.ts installs its hooks on import). Entity ids: 'ring-wagon' (tools spawn it; the runner
 * builds its wagons with `spawnWagon`), 'ring-lob'.
 */
import '../../../ring/boarding';
import { defineEntity } from '../../../registry';
import { RING_ENTITY } from '../../../ring/ids';
import { Wagon } from '../../../ring/wagon';
import './lob';

defineEntity(RING_ENTITY.wagon, (w, x, y, p) => new Wagon(w, x, y, p, { slot: p.slot === 1 ? 1 : 0, driver: typeof p.driver === 'string' ? p.driver : null }), {
  category: 'vehicle',
  description: 'the ring wagon (player vehicle; params slot 0 white / 1 green, driver)',
});
