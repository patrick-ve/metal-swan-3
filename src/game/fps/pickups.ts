/**
 * Pickups of the first-person mode (docs/design/fps.md §4.5): the item list of a floor (the
 * placed items plus the drops of killed enemies, one preallocated table), the effect of every
 * item with its caps and refusals, keys, treasure score through the PlayerSlot (extends apply),
 * the 1UP and the golden record. A refused item stays where it is. No allocations per tick.
 */
import { getRayBillboard, hasRayBillboard, type RayBillboard } from '../../engine/ray';
import { KEY_GOLD, KEY_SILVER } from './doors';
import type { ParsedItem } from './map';
import { MAX_AMMO, MAX_HP, type FpsPlayer } from './player';
import { WEAPON_CHAINGUN, WEAPON_KNIFE, WEAPON_MG } from './types';

/** Treasure ids and their score (§4.5). */
export const TREASURE_SCORE: Readonly<Record<string, number>> = {
  'pocket-watch': 100,
  'tuning-fork': 500,
  'gold-bars': 1000,
  'music-box': 5000,
  'golden-record': 10000,
};
export function isTreasure(id: string): boolean {
  return TREASURE_SCORE[id] !== undefined;
}

/** 1UP with full lives: points instead (§4.5). */
export const ONE_UP_SCORE = 10000;

/** The message of every pickup (§8.6: small font, at most 128 px; hud.test checks the widths). */
export const PICKUP_MESSAGES: Readonly<Record<string, string>> = {
  'first-aid': 'FIRST AID +25',
  food: 'MESS TIN +10',
  ration: 'RATION TIN +4',
  'blood-pool': 'DESPERATE +1',
  clip: 'AMMO +8',
  'clip-drop': 'AMMO +4',
  mg: 'MACHINE GUN!',
  chaingun: 'CHAINGUN!',
  'one-up': 'EXTRA LIFE!',
  'key-gold': 'GOLD KEY',
  'key-silver': 'SILVER KEY',
  'pocket-watch': 'POCKET WATCH +100',
  'tuning-fork': 'TUNING FORK +500',
  'gold-bars': 'GOLD BARS +1000',
  'music-box': 'MUSIC BOX +5000',
  'golden-record': 'GOLDEN RECORD! +10000',
};

/** What a pickup needs from the floor (FpsGame implements it). */
export interface PickupHost {
  readonly player: FpsPlayer;
  addScore(points: number): void;
  /** Add a life; false when the lives are full. */
  addLife(): boolean;
  message(text: string): void;
  sfx(id: string): void;
  /** The face grins (60 ticks) and the gold flash shows. */
  grin(): void;
  flash(): void;
  /** Ask for a weapon to come up (the weapon system decides when). */
  raise(w: number): void;
}

/** Bit of a weapon in `FpsPlayer.weapons`. */
function owns(p: FpsPlayer, w: number): boolean {
  return ((p.weapons >> w) & 1) !== 0;
}

/**
 * Apply item `id` to the player. Returns false when it is refused (it then stays).
 * Caps: HP 100, ammo 99. Ammo while on the knife with an empty pool raises the best gun.
 */
export function applyPickup(h: PickupHost, id: string): boolean {
  const p = h.player;
  switch (id) {
    case 'first-aid':
      return heal(h, 25, 'fps/pickup-health', id);
    case 'food':
      return heal(h, 10, 'fps/pickup-food', id);
    case 'ration':
      return heal(h, 4, 'fps/pickup-food', id);
    case 'blood-pool':
      if (p.hp > 10) return false;
      return heal(h, 1, 'fps/pickup-food', id);
    case 'clip':
      return ammo(h, 8, id);
    case 'clip-drop':
      return ammo(h, 4, id);
    case 'mg':
    case 'chaingun': {
      const w = id === 'mg' ? WEAPON_MG : WEAPON_CHAINGUN;
      if (owns(p, w) && p.ammo >= MAX_AMMO) return false;
      const had = owns(p, w);
      p.weapons |= 1 << w;
      p.ammo = Math.min(MAX_AMMO, p.ammo + 6);
      h.sfx('fps/pickup-weapon');
      h.message(PICKUP_MESSAGES[id]);
      h.grin();
      h.flash();
      // A new, better gun comes up at once (G).
      if (!had && w > p.weapon) h.raise(w);
      else if (p.weapon === WEAPON_KNIFE) h.raise(w);
      return true;
    }
    case 'one-up':
      if (!h.addLife()) h.addScore(ONE_UP_SCORE);
      p.hp = MAX_HP;
      giveAmmo(h, 25);
      h.sfx('item/1up');
      h.message(PICKUP_MESSAGES[id]);
      h.grin();
      h.flash();
      return true;
    case 'key-gold':
    case 'key-silver':
      p.keys |= id === 'key-gold' ? KEY_GOLD : KEY_SILVER;
      h.sfx('fps/pickup-key');
      h.message(PICKUP_MESSAGES[id]);
      h.flash();
      return true;
    default: {
      const score = TREASURE_SCORE[id];
      if (score === undefined) return false;
      h.addScore(score);
      h.sfx(id === 'golden-record' ? 'fps/pickup-record' : 'fps/pickup-treasure');
      h.message(PICKUP_MESSAGES[id]);
      h.flash();
      return true;
    }
  }
}

function heal(h: PickupHost, n: number, sfx: string, id: string): boolean {
  const p = h.player;
  if (p.hp >= MAX_HP) return false;
  p.hp = Math.min(MAX_HP, p.hp + n);
  h.sfx(sfx);
  h.message(PICKUP_MESSAGES[id]);
  h.flash();
  return true;
}

function ammo(h: PickupHost, n: number, id: string): boolean {
  if (h.player.ammo >= MAX_AMMO) return false;
  giveAmmo(h, n);
  h.sfx('fps/pickup-ammo');
  h.message(PICKUP_MESSAGES[id]);
  h.flash();
  return true;
}

/** Ammo up to the cap; the first ammo after an empty pool raises the best owned gun (G). */
function giveAmmo(h: PickupHost, n: number): void {
  const p = h.player;
  const wasEmpty = p.ammo <= 0;
  p.ammo = Math.min(MAX_AMMO, p.ammo + n);
  if (wasEmpty && p.weapon === WEAPON_KNIFE) {
    for (let w = WEAPON_CHAINGUN; w > WEAPON_KNIFE; w--) {
      if (owns(p, w)) {
        h.raise(w);
        break;
      }
    }
  }
}

/** The items of one floor: the placed ones first (map order), then the drops. */
export class ItemList {
  readonly cap: number;
  readonly id: string[];
  readonly x: Int16Array;
  readonly y: Int16Array;
  /** 1 = taken. The first `placed` entries match `map.items`. */
  readonly taken: Uint8Array;
  readonly bb: Array<RayBillboard | null>;
  count = 0;
  placed = 0;

  constructor(placed: readonly ParsedItem[], drops: number) {
    this.cap = placed.length + drops;
    this.id = new Array<string>(this.cap).fill('');
    this.x = new Int16Array(this.cap);
    this.y = new Int16Array(this.cap);
    this.taken = new Uint8Array(this.cap);
    this.bb = new Array<RayBillboard | null>(this.cap).fill(null);
    for (const it of placed) this.add(it.id, it.x, it.y);
    this.placed = this.count;
  }

  /** Add an item (a drop); false when the table is full. */
  add(id: string, x: number, y: number): boolean {
    if (this.count >= this.cap) return false;
    const k = this.count++;
    this.id[k] = id;
    this.x[k] = x;
    this.y[k] = y;
    this.taken[k] = 0;
    this.bb[k] = itemBillboard(id);
    return true;
  }

  /** An untaken item stands on cell (x, y). */
  at(x: number, y: number): boolean {
    for (let k = 0; k < this.count; k++) if (!this.taken[k] && this.x[k] === x && this.y[k] === y) return true;
    return false;
  }

  /** Treasures placed / taken (the drops never hold treasure). */
  treasure(): { taken: number; total: number; record: boolean } {
    let t = 0;
    let tt = 0;
    let record = false;
    for (let k = 0; k < this.placed; k++) {
      if (!isTreasure(this.id[k])) continue;
      tt++;
      if (this.taken[k]) {
        t++;
        if (this.id[k] === 'golden-record') record = true;
      }
    }
    return { taken: t, total: tt, record };
  }
}

/** `fps/item/<id>` when registered (else the item draws as nothing). */
export function itemBillboard(id: string): RayBillboard | null {
  const bid = `fps/item/${id}`;
  return hasRayBillboard(bid) ? getRayBillboard(bid) : null;
}
