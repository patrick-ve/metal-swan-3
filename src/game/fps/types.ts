/**
 * Types of the first-person mode (docs/design/fps.md §3.7, §5; docs/api/fps.md §3).
 * Pure types and tiny constants: every fps module and the eager scenes may import this file.
 */
import type { Color } from '../../engine/color';
import type { Difficulty, SlotIndex } from '../session';

export type Cardinal = 'N' | 'E' | 'S' | 'W';

/** Options a map char cannot carry (spec §5.2). `at` = [x, y] cell. */
export interface FpsThing {
  at: readonly [number, number];
  facing?: Cardinal;
  ambush?: boolean;
  patrol?: boolean;
  /** A patrol turn marker on a floor cell. */
  turn?: Cardinal;
  /** For pickups and props (actors use their char). */
  minDiff?: Difficulty;
  maxDiff?: Difficulty;
  /** Push wall texture (a wall letter, `A`–`P`). */
  tex?: string;
  /** A boss reinforcement point (with minDiff). */
  spawn?: 'ss';
}

export interface FpsFloorDef {
  /** 'fps-0' | 'fps-1' | 'fps-2'. */
  id: string;
  number: number;
  name: string;
  /** Par time in seconds. */
  par: number;
  /** Number of push walls (spec §5.3 rule 7). */
  secrets: number;
  /** One char per cell, all rows the same length (legend spec §5.1). */
  rows: readonly string[];
  things?: readonly FpsThing[];
  ceil: Color;
  floor: Color;
  /** 'fps-floor' | 'fps-boss'. */
  music: string;
  /** Wall letter → texture id (overrides the §5.1 defaults). */
  walls?: Partial<Record<string, string>>;
  boss?: boolean;
}

/** The ordered floors of a run (floor numbers → ids). */
export interface FpsEpisodeDef {
  id: string;
  /** Floor ids in play order (floor 0 is never part of an episode). */
  floors: readonly string[];
}

/** One tick of first-person input (built from `InputManager.actions` + `.analog`). */
export interface FpsInput {
  /** Held `ACTION_BIT` mask. */
  held: number;
  /** Actions pressed this tick. */
  pressed: number;
  /** Analog turn this tick (angle units, + = right). */
  turn: number;
  /** Analog strafe −127..127 (+ = right). */
  moveX: number;
  /** Analog forward −127..127 (+ = forward). */
  moveY: number;
}

/** Weapon bits of `FpsCarry.weapons`. */
export const WEAPON_KNIFE = 0;
export const WEAPON_PISTOL = 1;
export const WEAPON_MG = 2;
export const WEAPON_CHAINGUN = 3;

/** What carries from one floor to the next (spec §4.11; keys never carry). */
export interface FpsCarry {
  hp: number;
  ammo: number;
  /** Bit 0 knife … bit 3 chaingun. */
  weapons: number;
  /** Weapon index 0..3. */
  weapon: number;
}

export interface FloorResult {
  floor: number;
  ticks: number;
  kills: number;
  killsTotal: number;
  secrets: number;
  secretsTotal: number;
  treasure: number;
  treasureTotal: number;
  goldenRecord: boolean;
}

/** One fps run (from the bridge or `?mode=fps`) over its floors. */
export interface FpsRun {
  /** The fps slot (spec §1.10). */
  slot: SlotIndex;
  /** The floor being played (or next to play). */
  floor: number;
  /** Carry from the previous floor (null = the fresh loadout). */
  carry: FpsCarry | null;
  /** The slot's score at the floor card (a restart resets the score to it). */
  floorStartScore: number;
  results: FloorResult[];
  /** The current floor was entered once already (the next intro is a restart, not a first entry). */
  entered?: boolean;
}

/** Events of one `FpsGame` (payload objects are reused; copy what you keep). */
export interface FpsEvents {
  floorComplete: { result: FloorResult };
  playerDead: { floor: number };
  message: { text: string };
  extend: { lives: number };
  /** A push wall started to move (a secret found). */
  secret: { x: number; y: number };
  /** A door changed state ('opening' | 'closing' | 'locked'). */
  door: { index: number; state: 'opening' | 'closing' | 'locked' };
}
