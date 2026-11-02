/**
 * The HUD's budget line (docs/design/oat.md §7.5, the bank-app look): the amount rolls to a new
 * balance over 20 ticks, and a small `+€0,15` / `-€95` pop shows beside it (changes within 30 ticks
 * of the same sign add up). Display state only (per slot, kept here, never in the game state): the
 * HUD calls `budgetLine(slot, tick)` while it draws. No allocation once a slot was seen.
 */
import type { PlayerSlot } from '../session';
import type { Cents } from './types';

/** The roll's length (spec §7.5) and the pop's life on screen. */
export const ROLL_TICKS = 20;
export const POP_TICKS = 60;
const POP_MERGE_TICKS = 30;

interface LineState {
  from: Cents;
  to: Cents;
  start: number;
  pop: Cents;
  popStart: number;
  lastTick: number;
}

/** What the HUD draws: the shown amount, the pop (0 = none) and its age in ticks. */
export interface BudgetLine {
  shown: Cents;
  pop: Cents;
  popAge: number;
}

const states = new WeakMap<PlayerSlot, LineState>();
const out: BudgetLine = { shown: 0, pop: 0, popAge: 0 };

/** The budget line of `slot` at HUD tick `tick` (a reused record: read it, never keep it). */
export function budgetLine(slot: PlayerSlot, tick: number): BudgetLine {
  const now = slot.cents;
  let st = states.get(slot);
  // First sight, or the HUD's clock went back (a new scene): show the balance as it is.
  if (!st || tick < st.lastTick) {
    st = { from: now, to: now, start: tick - ROLL_TICKS, pop: 0, popStart: tick - POP_TICKS, lastTick: tick };
    states.set(slot, st);
  }
  st.lastTick = tick;
  if (now !== st.to) {
    const shown = rolled(st, tick);
    const delta = now - st.to;
    const merge = tick - st.popStart <= POP_MERGE_TICKS && Math.sign(st.pop) === Math.sign(delta) && st.pop !== 0;
    st.pop = merge ? st.pop + delta : delta;
    if (!merge) st.popStart = tick;
    st.from = shown;
    st.to = now;
    st.start = tick;
  }
  out.shown = rolled(st, tick);
  const age = tick - st.popStart;
  out.pop = age < POP_TICKS ? st.pop : 0;
  out.popAge = age;
  return out;
}

function rolled(st: LineState, tick: number): Cents {
  const k = Math.min(1, Math.max(0, (tick - st.start) / ROLL_TICKS));
  return k >= 1 ? st.to : Math.round(st.from + (st.to - st.from) * k);
}
