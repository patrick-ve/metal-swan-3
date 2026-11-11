/**
 * The pay path of the budget (docs/design/oat.md §7.1–§7.5; the contract: ./types.ts). Owner:
 * BUDGET. Everything here runs only in a play whose session economy is `'euro'` (MissionDef
 * `economy: 'euro'`: ams, oat, oldenzaal; the rally and the fps floors set it themselves); in a
 * point play (the dormant ring, m0–m5) every call does nothing.
 *
 * - `pay(world, slot, cents, x, y, category)`: the one signed pay call (books the slot's ledger,
 *   gives the extends, emits the `pay` event, raises the world pop-up). Content of the euro
 *   missions calls it directly (a can: `pay(world, owner, 15, x, y, 'deposit')`).
 * - The legacy sources (every `awardScore` of the ~30 shared pay sites) are converted WITHOUT a
 *   change at those sites: `awardScore` notes the points as a pending award (`noteAward`), and the
 *   events that follow it in the same call (`enemyKilled`, the world's `killed`, `pickup`, a
 *   `CAUGHT NAPPING +100` callout) claim it with the payer's euro row (euro-table.ts); what nobody
 *   claims pays by the legacy rule (÷ 50, € 0,50 steps, ≤ € 25) at the end of the tick
 *   (`flushAwards`). Points keep counting as before (the sims' `score` stays the same).
 * - The costs: the `BOETE` fine on a ticket death (`wireBudget` listens to `killed`), the
 *   toeristenbelasting on a continue (`chargeTouristTax`), the courtage skim of De Makelaar
 *   (`startCourtage` / `endCourtage`).
 * - Pop-ups are HUD records (`HudState.popup`), never entities (entity ids stay as they were);
 *   pop-ups of one player within 30 ticks and 64 px merge (`+€0,45`).
 *
 * ```ts
 * pay(world, owner, 15, x, y, 'deposit');      // a can: +€ 0,15
 * pay(world, slot, -9500, p.x, p.y, 'boete');   // a BOETE death: -€ 95,00
 * ```
 */
import type { Damage, Entity } from '../../engine/entity';
import type { World } from '../../engine/world';
import { gameOf, type ScorePopup } from '../context';
import type { Economy, GameSession, PlayerSlot } from '../session';
import { TUNING } from '../tuning';
import { hasEuroRow, killCents, MINI_BOSS_CENTS, NAPPING_CENTS, pointsToCents, RECORD_CENTS } from './euro-table';
import { euroText } from './format';
import { toCents } from './ledger';
import { fineFor, touristTax } from './tax';
import type { BudgetCategory, Cents, PayEvent } from './types';

/** The two economies of a play: legacy points, or the euro budget (spec §7.1; session.ts). */
export type { Economy };

/** Is the play of this world a euro play? */
export function euroOn(world: World): boolean {
  return gameOf(world).session.economy === 'euro';
}

// ---------------------------------------------------------------------------------------------
// Per-world state (no allocation per tick: fixed records)
// ---------------------------------------------------------------------------------------------

/** Most pending awards at once (a pickup notes two; a blast kills several, each claimed at once). */
const MAX_PENDING = 8;
/** Pop-ups of one player merge within this many ticks (spec §6.1, §7.5) and this many px. */
export const POP_MERGE_TICKS = 30;
const POP_MERGE_PX = 64;

interface PendingAward {
  live: boolean;
  slot: 0 | 1;
  points: number;
  x: number;
  y: number;
  hasPos: boolean;
  tick: number;
  /** Order of noting (the newest claims first). */
  seq: number;
}

interface PopState {
  popup: ScorePopup | null;
  cents: Cents;
  tick: number;
}

interface CourtageState {
  /** Skim per 10.000 of every pickup's income (150 = 1,5 %); 0 = off. */
  rate: number;
  /** Each player's pile in the briefcase (cents). */
  readonly pile: [Cents, Cents];
}

interface BudgetWorld {
  readonly pending: PendingAward[];
  readonly pops: [PopState, PopState];
  readonly courtage: CourtageState;
  wired: boolean;
  seq: number;
  /** The enemy `claimKill` settled in this tick: its own `killed` event must not claim a second award. */
  claimed: Entity | null;
}

const worlds = new WeakMap<World, BudgetWorld>();

function stateOf(world: World): BudgetWorld {
  let s = worlds.get(world);
  if (!s) {
    const pending: PendingAward[] = [];
    for (let i = 0; i < MAX_PENDING; i++) pending.push({ live: false, slot: 0, points: 0, x: 0, y: 0, hasPos: false, tick: 0, seq: 0 });
    s = {
      pending,
      pops: [
        { popup: null, cents: 0, tick: -1000 },
        { popup: null, cents: 0, tick: -1000 },
      ],
      courtage: { rate: 0, pile: [0, 0] },
      wired: false,
      seq: 0,
      claimed: null,
    };
    worlds.set(world, s);
  }
  return s;
}

const payEv: PayEvent = { player: 0, cents: 0, category: 'other' };

/** Categories of picked-up money (the courtage skims them: spec §4 "every euro any player picks up"). */
const PICKUP_CATEGORIES: ReadonlySet<BudgetCategory> = new Set<BudgetCategory>(['item', 'record', 'deposit', 'sponsor', 'wallet', 'treasure']);

// ---------------------------------------------------------------------------------------------
// Booking (scenes without a world use `bookSlot`)
// ---------------------------------------------------------------------------------------------

/**
 * Book `cents` in a slot's ledger and give the extends it earned (the lives). Returns the lives
 * added (the caller shows `ONE MORE TRY!` and plays the sound). Works in any economy (the tallies
 * call it only for euro plays).
 */
export function bookSlot(slot: PlayerSlot, cents: Cents, category: BudgetCategory, count = 1): number {
  const extends_ = slot.ledger.book(cents, category, count);
  return extends_ > 0 ? slot.addLife(extends_) : 0;
}

/**
 * Pay `cents` (signed; 0 does nothing) to player slot `slot` (0 / 1; anything else is ignored) in
 * `category`, with the pop-up at world (x, y) (undefined: no world pop-up; the HUD line still rolls).
 * Only in a euro play; elsewhere it does nothing. `count` = the items it counts on the kassabon.
 */
export function pay(world: World, slot: number | undefined, cents: Cents, x: number | undefined, y: number | undefined, category: BudgetCategory, count = 1): void {
  if ((slot !== 0 && slot !== 1) || !world) return;
  const g = gameOf(world);
  if (g.session.economy !== 'euro') return;
  const s = g.session.slots[slot];
  if (!s.joined) return;
  const c = toCents(cents);
  if (c === 0 && count === 0) return;
  const lives = bookSlot(s, c, category, count);
  // De Makelaar's courtage (spec §4): a skim of every pickup while he lives.
  const ct = stateOf(world).courtage;
  if (ct.rate > 0 && c > 0 && PICKUP_CATEGORIES.has(category)) {
    const skim = s.ledger.skim(c, ct.rate);
    if (skim > 0) {
      s.ledger.book(-skim, 'courtage', 0);
      ct.pile[slot] += skim;
    }
  }
  if (c !== 0 && x !== undefined && y !== undefined) popAt(world, slot, c, x, y);
  payEv.player = slot;
  payEv.cents = c;
  payEv.category = category;
  payEv.x = x;
  payEv.y = y;
  world.events.emit('pay', payEv);
  if (lives > 0) {
    g.hud.callout('ONE MORE TRY!');
    world.audio.sfx('item/1up');
    world.events.emit('extend', { player: slot, lives: s.lives });
  }
}

/** A world pop-up of `cents` for a player; a pop-up of the same sign within 30 ticks and 64 px grows instead (`+€0,45`). */
function popAt(world: World, slot: 0 | 1, cents: Cents, x: number, y: number): void {
  const hud = gameOf(world).hud;
  const st = stateOf(world).pops[slot];
  const prev = st.popup;
  const now = world.tick;
  if (prev && prev.ticks > 0 && now - st.tick <= POP_MERGE_TICKS && Math.sign(st.cents) === Math.sign(cents) && Math.abs(prev.x - x) <= POP_MERGE_PX && hud.popups.includes(prev)) {
    st.cents += cents;
    prev.text = euroText(st.cents, { plus: true, compact: true });
    if (prev.ticks < 20) prev.ticks = 20;
    return;
  }
  hud.popup(x, y, euroText(cents, { plus: true, compact: true }));
  st.popup = hud.popups[hud.popups.length - 1] ?? null;
  st.cents = cents;
  st.tick = now;
}

// ---------------------------------------------------------------------------------------------
// The legacy sources: pending awards and their claims
// ---------------------------------------------------------------------------------------------

/**
 * `awardScore` in a euro play: the points (already counted as points) wait as a pending award for
 * the event that names their payer. A full queue pays its oldest by the legacy rule.
 */
export function noteAward(world: World, slot: 0 | 1, points: number, x?: number, y?: number): void {
  const st = stateOf(world);
  let free: PendingAward | null = null;
  let oldest: PendingAward | null = null;
  for (const p of st.pending) {
    if (!p.live) {
      free = p;
      break;
    }
    if (!oldest || p.seq < oldest.seq) oldest = p;
  }
  if (!free && oldest) {
    settle(world, oldest, pointsToCents(oldest.points), 'other');
    free = oldest;
  }
  if (!free) return;
  free.live = true;
  free.slot = slot;
  free.points = points;
  free.hasPos = x !== undefined && y !== undefined;
  free.x = x ?? 0;
  free.y = y ?? 0;
  free.tick = world.tick;
  free.seq = ++st.seq;
}

/** Pay a pending award and free its record. */
function settle(world: World, p: PendingAward, cents: Cents, category: BudgetCategory): void {
  p.live = false;
  pay(world, p.slot, cents, p.hasPos ? p.x : undefined, p.hasPos ? p.y : undefined, category);
}

/** The newest live pending award of `slot` from this tick (optionally with exactly `points`). */
function newest(world: World, slot: number, points?: number): PendingAward | null {
  let best: PendingAward | null = null;
  for (const p of stateOf(world).pending) {
    if (!p.live || p.slot !== slot || p.tick !== world.tick) continue;
    if (points !== undefined && p.points !== points) continue;
    if (!best || p.seq > best.seq) best = p;
  }
  return best;
}

/** `enemyKilled`: the kill's own award pays its row (×2 for a knife kill of a soft enemy: `CONTANT`). */
export function claimKill(world: World, enemy: Entity, damage: Damage, points: number, player: number): void {
  // The world's `killed` for this enemy follows in the same tick: it is this kill, not a prop's.
  stateOf(world).claimed = enemy;
  const p = newest(world, player, points);
  if (!p) return;
  const knifeSoft = damage.kind === 'knife' && (enemy as Entity & { soft?: boolean }).soft === true;
  const base = knifeSoft ? points / TUNING.score.knifeMultiplier : points;
  const cents = killCents(enemy.type, base, knifeSoft);
  settle(world, p, cents, knifeSoft ? 'cash' : cents >= MINI_BOSS_CENTS ? 'boss' : 'enemy');
}

/**
 * The world's `killed`: a boss, a prop with a row (the breakables, `VERKOCHT` signs) or a crate
 * claims its owner's newest award of this tick; a player killed by a `BOETE` ticket pays the fine.
 */
export function claimKilled(world: World, target: Entity, damage: Damage): void {
  if (target.hasTag('player')) {
    if (damage.source?.type === 'boete-ticket') {
      const slot = (target as Entity & { index?: number }).index;
      chargeFine(world, slot, target.x, target.y - 40);
    }
    return;
  }
  const owner = damage.owner;
  if (owner !== 0 && owner !== 1) return;
  if (target === stateOf(world).claimed) return;
  const boss = target.hasTag('boss');
  if (!boss && !hasEuroRow(target.type) && !target.hasTag('prop') && !target.hasTag('crate')) return;
  const p = newest(world, owner);
  if (!p) return;
  const cents = hasEuroRow(target.type) ? killCents(target.type, p.points, false) : pointsToCents(p.points);
  settle(world, p, cents, boss ? 'boss' : 'prop');
}

/** `pickup`: the item's awards of this tick pay as `item` (the golden record's own award: € 50,00 `GOUDEN PLAAT`). */
export function claimPickup(world: World, slot: number, item: Entity): void {
  const record = (item as Entity & { params?: { kind?: unknown } }).params?.kind === 'golden-record';
  let last = true;
  for (let p = newest(world, slot); p; p = newest(world, slot)) {
    settle(world, p, record && last ? RECORD_CENTS : pointsToCents(p.points), record && last ? 'record' : 'item');
    last = false;
  }
}

/** A callout that names its points (`CAUGHT NAPPING +100`, `SET PIECE! +500`): its award pays now; the text names the euros. */
export function claimCallout(world: World, text: string): string {
  const m = / \+([\d,]+)$/.exec(text);
  if (!m) return text;
  const points = Number(m[1].replace(/,/g, ''));
  let hit: PendingAward | null = null;
  for (const p of stateOf(world).pending) if (p.live && p.points === points && p.tick === world.tick && (!hit || p.seq > hit.seq)) hit = p;
  const napping = text.startsWith('CAUGHT NAPPING');
  const cents = napping ? NAPPING_CENTS : pointsToCents(points);
  if (hit) settle(world, hit, cents, napping ? 'prop' : 'other');
  return `${text.slice(0, m.index)} ${euroText(cents, { plus: true, compact: true })}`;
}

/** The end of the tick: every unclaimed award pays by the legacy rule (`OVERIG`). */
export function flushAwards(world: World): void {
  const st = worlds.get(world);
  if (!st) return;
  st.claimed = null;
  for (const p of st.pending) if (p.live) settle(world, p, pointsToCents(p.points), 'other');
}

/**
 * Wire a euro play's world (the mission runner, each section): the claims and the fine. Point
 * plays are not wired (their worlds never see a budget listener).
 */
export function wireBudget(world: World): void {
  if (!euroOn(world)) return;
  const st = stateOf(world);
  if (st.wired) return;
  st.wired = true;
  world.events.on('enemyKilled', (e) => claimKill(world, e.enemy, e.damage, e.points, e.player));
  world.events.on('killed', (e) => claimKilled(world, e.target, e.damage));
  world.events.on('pickup', (e) => claimPickup(world, e.slot, e.item));
}

// ---------------------------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------------------------

/** A death by a `BOETE` ticket (spec §7.3): − € 95,00 `BOETE`; in oat-d − € 100,00 `BLOWVERBOD`. */
export function chargeFine(world: World, slot: number | undefined, x?: number, y?: number): void {
  if (slot !== 0 && slot !== 1) return;
  const f = fineFor(gameOf(world).session.sectionId);
  pay(world, slot, -f.cents, x, y, f.category);
}

/**
 * The toeristenbelasting of a continue (spec §7.3; the slot's continue count is already raised):
 * books it and returns the cents (positive: the cost; 0 in a point play). With a world: the pay
 * event and no world pop-up (the HUD line rolls); without one (fps): the ledger only.
 */
export function chargeTouristTax(session: GameSession, slot: PlayerSlot, world: World | null = null): Cents {
  if (session.economy !== 'euro') return 0;
  const tax = touristTax(slot.cents, slot.continues);
  if (world) pay(world, slot.index, -tax, undefined, undefined, 'tax');
  else bookSlot(slot, -tax, 'tax');
  return tax;
}

/** De Makelaar's courtage starts (spec §4: 1,5 % of every euro any player picks up; `rate` per 10.000). */
export function startCourtage(world: World, rate = 150): void {
  const ct = stateOf(world).courtage;
  ct.rate = Math.max(0, Math.floor(rate));
}

/** Each player's courtage pile so far (cents). */
export function courtagePile(world: World, slot: 0 | 1): Cents {
  return stateOf(world).courtage.pile[slot];
}

/** The courtage ends: with `giveBack` (his fall) each pile is paid back as `COURTAGE TERUG`. */
export function endCourtage(world: World, giveBack: boolean, x?: number, y?: number): void {
  const ct = stateOf(world).courtage;
  ct.rate = 0;
  for (const i of [0, 1] as const) {
    const pile = ct.pile[i];
    ct.pile[i] = 0;
    if (giveBack && pile > 0) pay(world, i, pile, x, y, 'courtageBack');
  }
}
