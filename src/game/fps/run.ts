/**
 * The fps run (docs/design/fps.md §1.10, §4.11): which slot plays, the floor, the carry from the
 * previous floor and the score at the floor card.
 */
import type { GameSession, PlayerSlot, SlotIndex } from '../session';
import type { FpsInput, FpsRun } from './types';

/**
 * The session record of the silent ams tally, `[p1, p2]` (spec §1.2): the glitch bridge writes it,
 * the floor-1 tally reads it (the MISSION 1 BONUS line). One key for both.
 */
export const AMS_BONUS_KEY = 'fps/ams-bonus';

/** The fps slot: `slots[0]` when it is active, else `slots[1]` (P1 may be out after the ams boss). */
export function fpsSlotIndex(session: GameSession): SlotIndex {
  return session.slots[0].active || !session.slots[1].active ? 0 : 1;
}

export function fpsSlot(session: GameSession): PlayerSlot {
  return session.slots[fpsSlotIndex(session)];
}

/** A fresh run for a session, starting at `floor` (the fresh loadout: `carry` null). */
export function newFpsRun(session: GameSession, floor: number): FpsRun {
  const slot = fpsSlotIndex(session);
  return { slot, floor, carry: null, floorStartScore: session.slots[slot].score, results: [] };
}

/** An empty input (no keys, no analog). */
export function emptyFpsInput(): FpsInput {
  return { held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 };
}

/**
 * The life count every fps screen shows (spec §4.13): the reserve lives (`lives − 1`), the same
 * count as the 2D HUD's icons and the final tally's LIVES LEFT.
 */
export function reserveLives(slot: PlayerSlot): number {
  return Math.max(0, slot.lives - 1);
}
