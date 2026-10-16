/**
 * The player's weapons (docs/design/fps.md §4.2): knife, pistol, machine gun, chaingun. Fire
 * cycles in ticks, the shot tick inside the cycle, the hold rules (the knife repeats, the pistol
 * fires once per press and queues a press from tick 14, the guns fire while held), the shared
 * ammo pool, the 8 + 8 tick switch and the out-of-ammo knife. `step` returns true on a shot tick;
 * the game resolves the hit (hitscan.ts) and the noise. No allocations.
 */
import { ACTION_BIT } from '../../engine/input-actions';
import type { FpsPlayer } from './player';
import { WEAPON_CHAINGUN, WEAPON_KNIFE, WEAPON_MG, WEAPON_PISTOL, type FpsInput } from './types';

export interface WeaponDef {
  id: 'knife' | 'pistol' | 'mg' | 'chaingun';
  /** Ammo per shot. */
  ammo: number;
  /** Cycle length (ticks) and the shot tick inside it. */
  cycle: number;
  shotOn: number;
  /** 'repeat' = held repeats (knife); 'press' = one shot per press (pistol); 'auto' = fires while held. */
  hold: 'repeat' | 'press' | 'auto';
  /** A press from this cycle tick on queues the next shot ('press' only). */
  queueFrom: number;
  /** Gunfire wakes the areas it reaches (§4.4); the knife is silent. */
  noise: boolean;
  sfx: string;
  /** Weapon view sprite (spec §8.3). */
  view: string;
}

export const WEAPONS: readonly WeaponDef[] = [
  { id: 'knife', ammo: 0, cycle: 24, shotOn: 8, hold: 'repeat', queueFrom: 99, noise: false, sfx: 'fps/knife', view: 'fps/view/knife' },
  { id: 'pistol', ammo: 1, cycle: 20, shotOn: 4, hold: 'press', queueFrom: 14, noise: true, sfx: 'fps/pistol', view: 'fps/view/pistol' },
  { id: 'mg', ammo: 1, cycle: 10, shotOn: 2, hold: 'auto', queueFrom: 99, noise: true, sfx: 'fps/mg', view: 'fps/view/mg' },
  { id: 'chaingun', ammo: 1, cycle: 5, shotOn: 1, hold: 'auto', queueFrom: 99, noise: true, sfx: 'fps/chaingun', view: 'fps/view/chaingun' },
];

/** Switching: the old weapon goes down over 8 ticks, the new one comes up over 8 (I). */
export const SWITCH_DOWN = 8;
export const SWITCH_UP = 8;

export const WP_IDLE = 0;
export const WP_FIRE = 1;
export const WP_DOWN = 2;
export const WP_UP = 3;

const SELECT_BITS: readonly number[] = [ACTION_BIT.weapon1, ACTION_BIT.weapon2, ACTION_BIT.weapon3, ACTION_BIT.weapon4];

/** The player owns weapon `w` and can use it (the knife always; a gun needs ammo). */
export function usable(p: FpsPlayer, w: number): boolean {
  if (((p.weapons >> w) & 1) === 0) return false;
  return w === WEAPON_KNIFE || p.ammo > 0;
}

/** The best owned gun with ammo, else the knife. */
export function bestWeapon(p: FpsPlayer): number {
  for (let w = WEAPON_CHAINGUN; w >= WEAPON_PISTOL; w--) if (usable(p, w)) return w;
  return WEAPON_KNIFE;
}

export class WeaponSystem {
  phase = WP_IDLE;
  /** Ticks in the phase (the cycle tick while firing). */
  timer = 0;
  /** The pistol's queued press. */
  queued = false;
  /** The weapon to switch to (-1 = none). */
  want = -1;
  /** Shots fired since the floor (re)start (tests, stats). */
  shots = 0;
  /** Sound hook (the game plays it at the player). */
  sfx: ((id: string) => void) | null = null;

  reset(): void {
    this.phase = WP_IDLE;
    this.timer = 0;
    this.queued = false;
    this.want = -1;
    this.shots = 0;
  }

  /** Ask for weapon `w` (it comes up after the current cycle and the switch). */
  request(p: FpsPlayer, w: number): boolean {
    if (!usable(p, w)) return false;
    if (w === p.weapon && this.phase !== WP_DOWN) {
      this.want = -1;
      return true;
    }
    this.want = w;
    return true;
  }

  /** Next / previous usable weapon from the current (or wanted) one. */
  cycle(p: FpsPlayer, dir: 1 | -1): void {
    const from = this.want >= 0 ? this.want : p.weapon;
    for (let k = 1; k <= 4; k++) {
      const w = (from + dir * k + 8) & 3;
      if (usable(p, w)) {
        this.request(p, w);
        return;
      }
    }
  }

  /** One tick of weapon input. Returns true when a shot happens this tick. */
  step(p: FpsPlayer, i: FpsInput): boolean {
    const pressed = i.pressed;
    for (let w = 0; w < 4; w++) if ((pressed & SELECT_BITS[w]) !== 0) this.request(p, w);
    if ((pressed & ACTION_BIT.weaponNext) !== 0) this.cycle(p, 1);
    if ((pressed & ACTION_BIT.weaponPrev) !== 0) this.cycle(p, -1);
    const held = (i.held & ACTION_BIT.fire) !== 0;
    const press = (pressed & ACTION_BIT.fire) !== 0;
    switch (this.phase) {
      case WP_IDLE: {
        // A gun with no ammo puts itself away (e.g. a carry with 0 ammo).
        if (p.weapon !== WEAPON_KNIFE && p.ammo <= 0 && this.want < 0) this.want = WEAPON_KNIFE;
        if (this.want >= 0 && this.want !== p.weapon) {
          this.phase = WP_DOWN;
          this.timer = 0;
          return false;
        }
        this.want = -1;
        const def = WEAPONS[p.weapon];
        const go = def.hold === 'press' ? press : held;
        if (go && (def.ammo === 0 || p.ammo > 0)) {
          this.phase = WP_FIRE;
          this.timer = 0;
          this.queued = false;
          return this.shotTick(p);
        }
        return false;
      }
      case WP_FIRE: {
        const def = WEAPONS[p.weapon];
        this.timer++;
        if (def.hold === 'press' && press && this.timer >= def.queueFrom) this.queued = true;
        if (this.timer >= def.cycle) {
          const again =
            (def.ammo === 0 || p.ammo > 0) &&
            (this.want < 0 || this.want === p.weapon) &&
            (def.hold === 'press' ? this.queued : held);
          if (!again) {
            this.phase = WP_IDLE;
            this.timer = 0;
            if (p.weapon !== WEAPON_KNIFE && p.ammo <= 0) this.want = WEAPON_KNIFE;
            if (this.want >= 0 && this.want !== p.weapon) {
              this.phase = WP_DOWN;
              this.timer = 0;
            }
            return false;
          }
          this.timer = 0;
          this.queued = false;
        }
        return this.shotTick(p);
      }
      case WP_DOWN:
        if (++this.timer >= SWITCH_DOWN) {
          const w = this.want >= 0 && ((p.weapons >> this.want) & 1) !== 0 ? this.want : WEAPON_KNIFE;
          p.weapon = w;
          this.want = -1;
          this.phase = WP_UP;
          this.timer = 0;
          this.sfx?.('fps/weapon-up');
        }
        return false;
      case WP_UP:
        if (++this.timer >= SWITCH_UP) {
          this.phase = WP_IDLE;
          this.timer = 0;
        }
        return false;
      default:
        return false;
    }
  }

  /** The shot of the cycle when `timer` is the shot tick (spends the ammo). */
  private shotTick(p: FpsPlayer): boolean {
    const def = WEAPONS[p.weapon];
    if (this.timer !== def.shotOn) return false;
    if (def.ammo > 0) {
      if (p.ammo < def.ammo) return false;
      p.ammo -= def.ammo;
    }
    this.shots++;
    this.sfx?.(def.sfx);
    return true;
  }

  /** The current weapon is being fired (or switched) — the HUD and the view read it. */
  get busy(): boolean {
    return this.phase !== WP_IDLE;
  }

  /** The weapon view frame (spec §8.3): 0 idle, 1 fire A (flash), 2 fire B, 3 recover. Knife: idle, wind-up, stab, return. */
  viewFrame(p: FpsPlayer): number {
    if (this.phase !== WP_FIRE) return 0;
    const def = WEAPONS[p.weapon];
    const t = this.timer;
    if (p.weapon === WEAPON_KNIFE) return t < def.shotOn ? 1 : t < def.shotOn + 6 ? 2 : 3;
    const flash = Math.max(1, Math.floor(def.cycle / 5));
    if (t < def.shotOn) return def.cycle <= 5 ? 3 : 0;
    if (t < def.shotOn + flash) return 1;
    if (t < def.shotOn + 2 * flash) return 2;
    return 3;
  }

  /** How far (px) the weapon view is lowered by a switch (0 = up). */
  viewDrop(): number {
    if (this.phase === WP_DOWN) return Math.round((this.timer / SWITCH_DOWN) * 60);
    if (this.phase === WP_UP) return Math.round(((SWITCH_UP - this.timer) / SWITCH_UP) * 60);
    return 0;
  }
}

/** Weapon names for the HUD fallback and messages. */
export const WEAPON_LABELS: readonly string[] = ['KNIFE', 'PISTOL', 'MACHINE GUN', 'CHAINGUN'];
export { WEAPON_CHAINGUN, WEAPON_KNIFE, WEAPON_MG, WEAPON_PISTOL };
