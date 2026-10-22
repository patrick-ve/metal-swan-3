/**
 * Content area `ring/zwaan` — the ZWAAN truck (docs/design/ring.md §R.3; the contract: api.ts;
 * docs/api/ring.md "Revision R"). Registers the controller `ring-zwaan` and loads the five real
 * parts (each file registers its entity with `defineEntity` + `defineZwaanPart`):
 *
 * | id | file | bar name |
 * |---|---|---|
 * | `ring-zwaan-container` | container.ts (TRAIN-1) | ZWAAN CONTAINER |
 * | `ring-zwaan-autos` | autos.ts (TRAIN-2) | ZWAAN AUTOTRANSPORT |
 * | `ring-zwaan-tank` | tank.ts (TRAIN-2) | ZWAAN TANKWAGEN |
 * | `ring-zwaan-vee` | vee.ts (TRAIN-2) | ZWAAN VEETRANSPORT |
 * | `ring-zwaan-cab` | cab.ts (TRAIN-1) | ZWARE JONGEN |
 *
 * The CORE-stage placeholder parts and their drawer are gone (wave A integration, fixer); the base
 * class draws a minimal 1× box. The sprites load through `ring/boss/art`.
 */
import { defineEntity } from '../../../registry';
import { RING_ZWAAN } from './api';
import { RingZwaan } from './controller';
import './container';
import './autos';
import './tank';
import './vee';
import './cab';

export * from './api';
export { RingZwaan, type ZwaanPhase } from './controller';
export { ZWAAN_DROP_WEAPONS, ZwaanPart, zwaanSlab, type ZwaanPartOpts } from './part';

defineEntity(RING_ZWAAN.controller, (w, x, y, p) => new RingZwaan(w, x, y, p), {
  category: 'hazard',
  description: 'The ZWAAN train controller (invisible): the plan lock, the parts in order, the catch-ups and their gangs, the waiting parts (params order, lane, adds).',
});
