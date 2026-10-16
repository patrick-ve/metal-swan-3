/**
 * The first-person player (docs/design/fps.md §4.1): turning (keys, mouse, stick), walking,
 * running, strafing, the collision box, the facing cell for "use", HP / ammo / weapons / keys.
 * Combat and pickups (group actors) add to this class; the movement rules live here.
 * No allocations per tick.
 */
import { ACTION_BIT, stickSpeed } from '../../engine/input-actions';
import { angNorm, COS, SIN, tryMove, type Blockers, type DoorTable, type MoveBox, type PushWall, type RayGrid } from '../../engine/ray';
import { cardinalIndex, DIR_DX, DIR_DY } from './map';
import { WEAPON_KNIFE, WEAPON_PISTOL, type FpsCarry, type FpsInput } from './types';

export const PLAYER_RADIUS = 0.34;
export const WALK_SPEED = 0.09;
export const RUN_SPEED = 0.15;
/** Key turn, angle units per tick (24 ≈ 127°/s; 44 with run). */
export const TURN_SPEED = 24;
export const TURN_SPEED_RUN = 44;
/** The first ticks of a key turn run at half speed (fine aim). */
export const TURN_SLOW_TICKS = 6;
export const MAX_HP = 100;
export const MAX_AMMO = 99;
export const START_AMMO = 8;

const B = ACTION_BIT;

/** The fresh loadout (spec §4.1): knife + pistol, 8 ammo, HP 100. */
export function freshCarry(): FpsCarry {
  return { hp: MAX_HP, ammo: START_AMMO, weapons: (1 << WEAPON_KNIFE) | (1 << WEAPON_PISTOL), weapon: WEAPON_PISTOL };
}

export class FpsPlayer {
  /** Collision box (centre x, y in tiles, half-size r); `x`/`y` read it. */
  readonly box: MoveBox = { x: 0, y: 0, r: PLAYER_RADIUS };
  /** Integer angle 0..4095 (0 east, 1024 south). */
  angle = 0;
  hp = MAX_HP;
  ammo = START_AMMO;
  /** Bit 0 knife … bit 3 chaingun. */
  weapons = 3;
  weapon = WEAPON_PISTOL;
  /** KEY_GOLD | KEY_SILVER. */
  keys = 0;
  /** Ticks the current key turn has been held (0 = none). */
  turnTicks = 0;
  /** The speed of the last move (tiles/tick; for the view bob and tools). */
  speed = 0;

  get x(): number {
    return this.box.x;
  }
  get y(): number {
    return this.box.y;
  }

  /** Place at a cell centre / pose and apply a loadout (null = fresh). Keys are cleared. */
  reset(x: number, y: number, angle: number, carry: FpsCarry | null): void {
    const c = carry ?? freshCarry();
    this.box.x = x;
    this.box.y = y;
    this.angle = angNorm(angle);
    this.hp = Math.max(1, Math.min(MAX_HP, c.hp));
    this.ammo = Math.max(0, Math.min(MAX_AMMO, c.ammo));
    this.weapons = c.weapons | (1 << WEAPON_KNIFE);
    this.weapon = (this.weapons >> c.weapon) & 1 ? c.weapon : WEAPON_KNIFE;
    this.keys = 0;
    this.turnTicks = 0;
    this.speed = 0;
  }

  carry(): FpsCarry {
    return { hp: this.hp, ammo: this.ammo, weapons: this.weapons, weapon: this.weapon };
  }

  /** Facing cardinal index (0 E, 1 S, 2 W, 3 N). */
  get facing(): number {
    return cardinalIndex(this.angle);
  }
  /** The cell in front (the "use" reach). */
  get frontX(): number {
    return Math.floor(this.box.x) + DIR_DX[this.facing];
  }
  get frontY(): number {
    return Math.floor(this.box.y) + DIR_DY[this.facing];
  }

  /** Turn and move for one tick of input. */
  move(i: FpsInput, g: RayGrid, d: DoorTable, push: PushWall | null, blockers?: Blockers): void {
    const held = i.held;
    const run = (held & B.run) !== 0;
    const strafeMod = (held & B.strafe) !== 0;
    const left = (held & B.turnLeft) !== 0;
    const right = (held & B.turnRight) !== 0;

    // Turning: the turn keys (unless the strafe modifier turns them into strafes) + analog.
    let turn = 0;
    if (!strafeMod && left !== right) {
      this.turnTicks++;
      const full = run ? TURN_SPEED_RUN : TURN_SPEED;
      const sp = this.turnTicks <= TURN_SLOW_TICKS ? full >> 1 : full;
      turn = right ? sp : -sp;
    } else this.turnTicks = 0;
    this.angle = angNorm(this.angle + turn + (i.turn | 0));

    // Movement: keys and stick add up as vectors, clamped to the run speed.
    const keySpeed = run ? RUN_SPEED : WALK_SPEED;
    let fwd = (((held & B.forward) !== 0 ? 1 : 0) - ((held & B.back) !== 0 ? 1 : 0)) * keySpeed;
    let side = 0;
    if ((held & B.strafeRight) !== 0) side += 1;
    if ((held & B.strafeLeft) !== 0) side -= 1;
    if (strafeMod) {
      if (right) side += 1;
      if (left) side -= 1;
    }
    side = Math.max(-1, Math.min(1, side)) * keySpeed;
    if (i.moveX !== 0 || i.moveY !== 0) {
      const sp = stickSpeed(i.moveX, i.moveY, run, WALK_SPEED, RUN_SPEED);
      const len = Math.hypot(i.moveX, i.moveY);
      fwd += (i.moveY / len) * sp;
      side += (i.moveX / len) * sp;
    }
    let mag = Math.hypot(fwd, side);
    if (mag > RUN_SPEED) {
      fwd *= RUN_SPEED / mag;
      side *= RUN_SPEED / mag;
      mag = RUN_SPEED;
    }
    this.speed = mag;
    if (mag === 0) return;
    const c = COS[this.angle];
    const s = SIN[this.angle];
    // Right of the facing = the facing turned +90° (y grows south): (−sin, cos).
    const dx = fwd * c - side * s;
    const dy = fwd * s + side * c;
    tryMove(g, d, push, this.box, dx, dy, blockers, -1);
  }
}
