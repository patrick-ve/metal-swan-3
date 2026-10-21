/**
 * Timed status effects on a player (gimmicks such as Helium Head, a slowing goo, a shield, a
 * forced weapon). An effect is plain data plus optional hooks; the Player asks the aggregated
 * values every tick. Register shared effects by id so every module uses the same definition:
 * ```ts
 * defineStatus({ id: 'helium-head', ticks: 600, jump: 4.5 / 3.5, fallGravity: 0.05, maxFall: 1, speed: 0.9,
 *   noCrouch: true, noMount: true, sfxPitch: 1.6, art: 'helium', onHit: popHead, onDraw: drawBalloon });
 * player.status.add(getStatus('helium-head')!);   // again later = refresh the timer
 * ```
 */
import type { Color } from '../../engine/color';
import type { Damage } from '../../engine/entity';
import type { Renderer } from '../../engine/render';
import type { Player } from './player';

export interface StatusEffectDef {
  id: string;
  /** Duration in ticks (Infinity = until removed). */
  ticks: number;
  /** Run, crawl and air speed multiplier. */
  speed?: number;
  /** Jump velocity multiplier. */
  jump?: number;
  /** Gravity multiplier (always). */
  gravity?: number;
  /** Gravity while falling with jump held (a float; Helium Head 0.05). */
  fallGravity?: number;
  /** Fastest fall while falling with jump held (Helium Head 1.0). */
  maxFall?: number;
  /** Weapon used while active (the slot's own weapon and ammo come back afterwards; no ammo use). */
  weapon?: string;
  /** Swap left and right. */
  invertControls?: boolean;
  noJump?: boolean;
  noCrouch?: boolean;
  noFire?: boolean;
  noBomb?: boolean;
  /** Vehicles cannot be entered (the player floats off the seat). */
  noMount?: boolean;
  /** All input is ignored (a dizzy spin, a yawn); physics still runs. */
  noControl?: boolean;
  /** Pitch multiplier of the player's own sounds (Helium Head 1.6). */
  sfxPitch?: number;
  /**
   * Sprite infix: while active the player draws `<art>/<infix>-<anim>` (e.g.
   * `char/grace/helium-legs-run`) wherever such a strip is registered, else the normal one.
   */
  art?: string;
  /** HUD icon sprite (shown with a 24×2 timer bar under the player's block; GDD §13.7). */
  icon?: string;
  /** Colour drawn over the player's sprites, with `tintAlpha` (default 0.4). */
  tint?: Color;
  tintAlpha?: number;
  /**
   * Opt-in (off when unset): fire-rate multiplier of the main gun while active (1.5 = 50 % more
   * shots: the cooldown and the hold-repeat shrink by it; `Gun.rate`). Aggregates multiply.
   */
  fireRate?: number;
  /**
   * Opt-in (off when unset): while active and `left(p) > 0`, BOMB throws this weapon instead of
   * the slot's bombs (no slot bomb is used; the HUD's bomb slot shows `icon` and the count). The
   * newest effect with one wins. Mission oldenzaal's frikandel bombs.
   */
  bomb?: StatusBomb;
  /**
   * Opt-in (off when unset): the HUD status slot draws `icon` frame `iconFrame(p, ticksLeft)`
   * (a countdown ring drawn in the icon's frames) and, with `hudBar: false`, no timer bar.
   */
  iconFrame?(player: Player, ticksLeft: number): number;
  hudBar?: boolean;
  /**
   * Opt-in (off when unset): the effect survives a section change (the new section's Player of
   * the same slot gets it back with the ticks it had left; death and `clear()` end it as usual).
   */
  carry?: boolean;
  /** Return true to absorb a hit (shield); the effect may remove itself. */
  onHit?(player: Player, d: Damage): boolean;
  onStart?(player: Player): void;
  onTick?(player: Player, ticksLeft: number): void;
  onEnd?(player: Player): void;
  /** Extra drawing on top of the player (world space): a balloon head, a parachute … */
  onDraw?(player: Player, r: Renderer, ticksLeft: number): void;
}

/** A status' replacement of the BOMB throw (`StatusEffectDef.bomb`). */
export interface StatusBomb {
  /** The weapon id the BOMB button throws (a registered weapon, kind 'bomb'). */
  readonly weapon: string;
  /** HUD icon of the bomb slot while it is in use (default the weapon's icon). */
  readonly icon?: string;
  /** Throws left (the HUD count; 0 = the slot's own bombs again). */
  left(player: Player): number;
  /** One was thrown: count it down (the effect may remove itself). */
  onThrow(player: Player): void;
}

/**
 * Carried effects per player slot (`StatusEffectDef.carry`), keyed by the slot object of the
 * session: a section change makes a new Player for the same slot, which picks them up.
 */
const carried = new WeakMap<object, ActiveStatus[]>();

export interface ActiveStatus {
  readonly def: StatusEffectDef;
  ticks: number;
}

export class StatusEffects {
  readonly list: ActiveStatus[] = [];
  /** Aggregates, refreshed whenever the list changes and every tick. */
  speed = 1;
  jump = 1;
  gravity = 1;
  /** null = not changed by any effect. */
  fallGravity: number | null = null;
  maxFall: number | null = null;
  weapon: string | null = null;
  invert = false;
  noJump = false;
  noCrouch = false;
  noFire = false;
  noBomb = false;
  noMount = false;
  noControl = false;
  sfxPitch = 1;
  /** Fire-rate multiplier (`fireRate`; 1 = unchanged). */
  fireRate = 1;
  /** The newest active BOMB replacement (`bomb`), else null. */
  bomb: StatusBomb | null = null;
  /** Sprite infix of the newest effect that has one ('' = none). */
  art = '';
  tint: Color = 0;
  tintAlpha = 0;
  private readonly owner: Player;

  constructor(owner: Player) {
    this.owner = owner;
    // Carried effects of this slot (none unless a `carry` effect was active in the last section).
    const slot = (owner as { slot?: object } | undefined)?.slot;
    const keep = slot ? carried.get(slot) : undefined;
    if (keep && keep.length) {
      for (const s of keep) this.list.push(s);
      this.refresh();
    }
  }

  /** Keep the slot's list of carried effects in step with this list (only `carry` effects). */
  private syncCarry(): void {
    const slot = (this.owner as { slot?: object } | undefined)?.slot;
    if (!slot) return;
    const keep = this.list.filter((s) => s.def.carry === true);
    if (keep.length) carried.set(slot, keep);
    else carried.delete(slot);
  }

  /** Start an effect (or refresh its timer if it is already active). */
  add(def: StatusEffectDef, ticks: number = def.ticks): void {
    const cur = this.list.find((s) => s.def.id === def.id);
    if (cur) cur.ticks = Math.max(cur.ticks, ticks);
    else {
      this.list.push({ def, ticks });
      def.onStart?.(this.owner);
    }
    if (def.carry) this.syncCarry();
    this.refresh();
  }

  has(id: string): boolean {
    return this.list.some((s) => s.def.id === id);
  }

  /** Ticks left of an effect (0 when not active). */
  ticksLeft(id: string): number {
    return this.list.find((s) => s.def.id === id)?.ticks ?? 0;
  }

  remove(id: string): void {
    const i = this.list.findIndex((s) => s.def.id === id);
    if (i < 0) return;
    const [s] = this.list.splice(i, 1);
    s.def.onEnd?.(this.owner);
    if (s.def.carry) this.syncCarry();
    this.refresh();
  }

  /** End every effect (death, section change). */
  clear(): void {
    let carry = false;
    while (this.list.length) {
      const s = this.list.pop() as ActiveStatus;
      if (s.def.carry) carry = true;
      s.def.onEnd?.(this.owner);
    }
    if (carry) this.syncCarry();
    this.refresh();
  }

  /** Count down; called once per tick by the Player. */
  update(): void {
    if (this.list.length === 0) return;
    let changed = false;
    let carry = false;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      if (s.ticks !== Infinity) s.ticks--;
      s.def.onTick?.(this.owner, s.ticks);
      if (s.ticks <= 0) {
        this.list.splice(i, 1);
        s.def.onEnd?.(this.owner);
        changed = true;
        if (s.def.carry) carry = true;
      }
    }
    if (carry) this.syncCarry();
    if (changed) this.refresh();
  }

  /** Let effects absorb a hit. */
  onHit(d: Damage): boolean {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i].def.onHit;
      if (h && h(this.owner, d)) return true;
    }
    return false;
  }

  /** Draw the effects' extras (called by Player.draw). */
  draw(r: Renderer): void {
    for (let i = 0; i < this.list.length; i++) {
      const s = this.list[i];
      s.def.onDraw?.(this.owner, r, s.ticks);
    }
  }

  private refresh(): void {
    this.speed = 1;
    this.jump = 1;
    this.gravity = 1;
    this.fallGravity = null;
    this.maxFall = null;
    this.weapon = null;
    this.invert = this.noJump = this.noCrouch = this.noFire = this.noBomb = this.noMount = this.noControl = false;
    this.sfxPitch = 1;
    this.fireRate = 1;
    this.bomb = null;
    this.art = '';
    this.tint = 0;
    this.tintAlpha = 0;
    for (const s of this.list) {
      const d = s.def;
      if (d.speed !== undefined) this.speed *= d.speed;
      if (d.jump !== undefined) this.jump *= d.jump;
      if (d.gravity !== undefined) this.gravity *= d.gravity;
      if (d.fallGravity !== undefined) this.fallGravity = d.fallGravity;
      if (d.maxFall !== undefined) this.maxFall = d.maxFall;
      if (d.weapon) this.weapon = d.weapon;
      if (d.invertControls) this.invert = true;
      if (d.noJump) this.noJump = true;
      if (d.noCrouch) this.noCrouch = true;
      if (d.noFire) this.noFire = true;
      if (d.noBomb) this.noBomb = true;
      if (d.noMount) this.noMount = true;
      if (d.noControl) this.noControl = true;
      if (d.sfxPitch !== undefined) this.sfxPitch *= d.sfxPitch;
      if (d.fireRate !== undefined) this.fireRate *= d.fireRate;
      if (d.bomb) this.bomb = d.bomb;
      if (d.art) this.art = d.art;
      if (d.tint) {
        this.tint = d.tint;
        this.tintAlpha = d.tintAlpha ?? 0.4;
      }
    }
  }
}
