/**
 * The pickups of GDD §7.1 (scores §14.3). Sprites: pickups.art.ts.
 *
 * | id | params | effect · score |
 * |---|---|---|
 * | `pickup-weapon` | `weapon`: weapon id or crate letter | the weapon (riding: stored for later) · 500; bounces when it lands |
 * | `pickup-bombs` | `count` (10) | +10 grenades (cap 99; riding: +10 shells) · 500 |
 * | `pickup-food` | `kind`: bread, cheese, teacake, jelly, birthday-cake | score only · 100 / 300 / 500 / 1,000 / 5,000 |
 * | `pickup-gem` | `kind`: golden-note, gem, medal, golden-record; `float` | score only, sparkle · 100 / 1,000 / 2,000 / 10,000 |
 * | `pickup-1up` | — | +1 life (9 in reserve at most) · 0, or 10,000 with full lives; waddles to the nearest player |
 * | `pickup-repair` | — | riding: +1 vehicle cell · on foot or with full cells: 1,000 |
 * | `loot` | `contains` / `table`: any drop value | rolls it and becomes the rolled item (enemy drops) |
 *
 * `pickup-gem` with `float: true` has no gravity: it hangs at its placed y with its 12×12 box
 * sitting on that y (the glide-trail notes of m1-c and m3-a). Golden notes without it drift down
 * slowly and hover over the floor.
 */
import type { World } from '../../../engine/world';
import { hasSprite } from '../../../engine/sprites';
import { bombsEffect, lifeEffect, Pickup, repairEffect, type PickupSpec } from '../../pickup';
import { defineEntity, getWeapon, hasWeapon, paramBool, paramNum, paramStr, type SpawnParams } from '../../registry';
import { Vehicle } from '../../vehicle';
import { FOOD_SCORE, GEM_SCORE, letterForWeapon, makeLoot, weaponForLetter } from './drops';

/** The first registered sprite id of a list (the last one is the fallback). */
export function firstSprite(...ids: string[]): string {
  for (const id of ids) if (hasSprite(id)) return id;
  return ids[ids.length - 1];
}

// ---------------------------------------------------------------------------------------------
// Weapon medallion
// ---------------------------------------------------------------------------------------------

/** The weapon id a `weapon` param names (a crate letter or an id). */
export function weaponParam(p: SpawnParams): string {
  const v = paramStr(p, 'weapon', 'machine-gun');
  if (/^[A-Za-z]$/.test(v)) return weaponForLetter(v) ?? 'machine-gun';
  return v;
}

/** A vehicle that converts weapon medallions itself (duck-typed: fleet/trumpeter.ts). */
interface WeaponPickupVehicle {
  weaponPickup?: (weapon?: string) => boolean;
}

function weaponPickup(world: World, x: number, y: number, p: SpawnParams): Pickup {
  const id = weaponParam(p);
  const def = hasWeapon(id) ? getWeapon(id) : null;
  const letter = (def?.letter ?? letterForWeapon(id) ?? id.charAt(0)).toLowerCase();
  const spec: PickupSpec = {
    sprite: firstSprite(`item/pickup-weapon/${id}`, `item/pickup-${id}`, `item/pickup-${letter}`),
    effect: (pl) => {
      pl.giveWeapon(id);
    },
    // A ship that turns weapons into ammo (the Trumpeter: +10 dive bombs) takes it instead.
    vehicleEffect: (v, pl) => {
      const conv = (v as WeaponPickupVehicle).weaponPickup;
      if (typeof conv === 'function' && conv.call(v, id)) return true;
      pl.giveWeapon(id);
    },
    sfx: 'item/weapon',
    score: 500,
    w: 16,
    h: 16,
    bounce: 0.45,
  };
  return new Pickup(world, x, y, spec, p);
}

defineEntity('pickup-weapon', weaponPickup, { category: 'item', score: 500, description: 'Weapon medallion (param weapon: id or crate letter).' });

// ---------------------------------------------------------------------------------------------
// Bombs
// ---------------------------------------------------------------------------------------------

defineEntity(
  'pickup-bombs',
  (w, x, y, p) => {
    const n = Math.max(1, Math.round(paramNum(p, 'count', 10)));
    const add = bombsEffect(n);
    const spec: PickupSpec = {
      sprite: 'item/pickup-bombs',
      effect: (pl, item) => {
        add(pl, item);
        pl.world.audio.voice(pl.state === 'mounted' ? 'RELOAD!' : 'EXTRA BOMBS!');
        return true;
      },
      sfx: 'item/bombs',
      score: 500,
      message: `BOMBS +${n}`,
      w: 16,
      h: 12,
    };
    return new Pickup(w, x, y, spec, p);
  },
  { category: 'item', score: 500, description: '+10 grenades (riding: +10 shells).' },
);

// ---------------------------------------------------------------------------------------------
// Food and treasure
// ---------------------------------------------------------------------------------------------

/** Hitbox sizes of the food kinds (GDD §7.1 looks). */
const FOOD_BOX: Readonly<Record<string, readonly [number, number]>> = {
  bread: [12, 8],
  cheese: [12, 8],
  teacake: [12, 10],
  jelly: [12, 12],
  'birthday-cake': [16, 16],
};

defineEntity(
  'pickup-food',
  (w, x, y, p) => {
    const kind = paramStr(p, 'kind', 'bread') in FOOD_SCORE ? paramStr(p, 'kind', 'bread') : 'bread';
    const [bw, bh] = FOOD_BOX[kind] ?? [12, 10];
    const spec: PickupSpec = {
      sprite: firstSprite(`item/pickup-food/${kind}`, 'item/pickup-food'),
      effect: () => {},
      sfx: 'item/food',
      score: FOOD_SCORE[kind],
      w: bw,
      h: bh,
      tags: ['food'],
    };
    return new Pickup(w, x, y, spec, p);
  },
  { category: 'item', description: 'Food for points (param kind).' },
);

/** Treasure sounds ring higher the more they are worth (GDD §12.1 item/gem). */
const GEM_PITCH: Readonly<Record<string, number>> = { 'golden-note': 1, gem: 1.12, medal: 1.26, 'golden-record': 1.5 };

defineEntity(
  'pickup-gem',
  (w, x, y, p) => {
    const kind = paramStr(p, 'kind', 'gem') in GEM_SCORE ? paramStr(p, 'kind', 'gem') : 'gem';
    const float = paramBool(p, 'float', false);
    const note = kind === 'golden-note';
    const spec: PickupSpec = {
      sprite: firstSprite(`item/pickup-gem/${kind}`, 'item/pickup-gem'),
      effect: () => {},
      sfx: 'item/gem',
      sfxPitch: GEM_PITCH[kind],
      score: GEM_SCORE[kind],
      w: 12,
      h: 12,
      sparkle: true,
      gravity: !float,
      // A golden note drifts down like a feather and hovers over the floor.
      fall: note && !float ? { gravity: 0.05, maxFall: 0.8 } : undefined,
      hover: note && !float ? 3 : 0,
      bob: float ? 1 : undefined,
    };
    return new Pickup(w, x, y, spec, p);
  },
  { category: 'item', description: 'Treasure for points (params kind, float).' },
);

// ---------------------------------------------------------------------------------------------
// Extra life and repair kit
// ---------------------------------------------------------------------------------------------

defineEntity(
  'pickup-1up',
  (w, x, y, p) => {
    const spec: PickupSpec = {
      sprite: firstSprite('item/pickup-1up', 'item/pickup-gem'),
      effect: lifeEffect(1, 10000),
      sfx: 'item/1up',
      voice: 'ONE MORE TRY!',
      message: '1UP',
      w: 14,
      h: 12,
      // The tin cygnet waddles toward the nearest player (GDD §7.1).
      waddle: 0.5,
      bob: 0,
      magnet: 12,
    };
    return new Pickup(w, x, y, spec, p);
  },
  { category: 'item', description: '+1 life (10,000 points when the lives are full).' },
);

defineEntity(
  'pickup-repair',
  (w, x, y, p) => {
    const fix = repairEffect(1);
    const spec: PickupSpec = {
      sprite: firstSprite('item/pickup-repair', 'item/pickup-bombs'),
      effect: (pl, item) => {
        const v = pl.state === 'mounted' ? pl.vehicle : null;
        const repairs = v instanceof Vehicle && v.cells < v.maxCells;
        fix(pl, item);
        if (repairs) pl.world.audio.voice('PATCHED UP!');
        return true;
      },
      sfx: 'item/repair',
      w: 14,
      h: 14,
    };
    return new Pickup(w, x, y, spec, p);
  },
  { category: 'item', description: '+1 vehicle cell (1,000 points on foot or with full cells).' },
);

// ---------------------------------------------------------------------------------------------
// Loot: a drop value where an entity id is expected
// ---------------------------------------------------------------------------------------------

defineEntity('loot', makeLoot, {
  category: 'item',
  description: 'Rolls a drop value (param contains: letter, kind, table name …) and becomes the item.',
});
