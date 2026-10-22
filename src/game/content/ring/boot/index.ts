/**
 * The pink boat `DE LAATSTE DRUPPEL` (wave B; docs/design/ring.md §R.7; docs/api/ring.md "R.B Wave B
 * contracts"): the boss `ring-boot` and the leader NPC `ring-leider`. Loaded by `ring/foot`
 * (foot/index.ts) and by the content manifest entry `ring/boot`. It needs the activists (the waves'
 * lopers, the police): `ring/activists` is imported first.
 *
 * BLOCKADE+BOAT (wave B): the real boat (boat.ts: `PinkBoat`, `BoatLeader`) and its art (art.ts).
 * (PREP's stub is gone.)
 */
import '../activists/index';
import './boat';
import './art';

export * from './api';
