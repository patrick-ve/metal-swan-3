/**
 * Content category "items": crates, pickups, hostages and their drops (GDD §7, §14.3). Registers
 * at import time; the API reference is docs/api/items.md.
 *
 * | id | params | notes |
 * |---|---|---|
 * | `crate` | `contains` (aliases `contents`, `drop`): any drop value; `hp` (30); `variant` (`supply` · `legion`); `chute` | breakable 24×20 supply crate: shots, any knife or explosion; 100 points; drops its contents (else table `crate`) |
 * | `pickup-weapon` | `weapon` (id or crate letter) | round ivory medallion, 500 |
 * | `pickup-bombs` | `count` (10) | +10 grenades (riding: +10 shells), 500 |
 * | `pickup-food` | `kind`: bread, cheese, teacake, jelly, birthday-cake | 100 / 300 / 500 / 1,000 / 5,000 |
 * | `pickup-gem` | `kind`: golden-note, gem, medal, golden-record; `float` | 100 / 1,000 / 2,000 / 10,000 |
 * | `pickup-1up` / `pickup-repair` | — | +1 life (10,000 when full) / +1 vehicle cell (1,000 on foot or full) |
 * | `loot` | `contains` / `table` | a drop value as an entity (enemy drops: `drop: { id: 'loot', params: { contains: 'officer' } }`) |
 * | `hostage` | `kind`, `bind`, `drop` (aliases `gives`, `item`) | see hostages.ts and binds.ts |
 *
 * Drop values (crate `contains`, hostage `drop`): a crate letter `M S R F L H T B`, a weapon id,
 * `bombs`, `repair`, `1up`, a food or gem kind, `auto` (the owner's table), a table name
 * (`table-a` … `table-d`, `crate`, `officer`, `truck`), `none`, an entity id or `{ id, params }`.
 * Drop rolls use `world.rng` (gameplay), so runs stay reproducible.
 */
import { defineEntity } from '../../registry';
import { Crate } from './crate';
import './pickups';
import './hostages';

export { Crate, CRATE_SCORE, type CrateVariant } from './crate';
export {
  contentsSpecs,
  dropItems,
  DROP_TABLES,
  FOOD_KINDS,
  FOOD_SCORE,
  GEM_KINDS,
  GEM_SCORE,
  KIND_TABLES,
  letterForWeapon,
  REPAIR_DROP_MISSIONS,
  REPAIR_SHARE,
  repairWanted,
  roll,
  rollRepair,
  spawnDrops,
  weaponForLetter,
  withVehicleDrops,
  WEAPONS_A,
  WEAPONS_B,
} from './drops';
export { firstSprite, weaponParam } from './pickups';
export { drawRope, makeBind, MastPole } from './binds';
export { BIND_IDS, CAGE_H, CAGE_W, DANGLE_HANDS, type BindId } from './ids';
export { HOSTAGE_KINDS, isHostage, KINDS, kindId, makeHostage, PHOTO_TICKS, sayCheese, type HostageKindId } from './hostages';
export { HOSTAGE_FREE_SCORE } from '../../hostage';

defineEntity('crate', (w, x, y, p) => new Crate(w, x, y, p), {
  category: 'prop',
  score: 100,
  description: 'Breakable supply crate (params contains, variant, chute, hp).',
});
