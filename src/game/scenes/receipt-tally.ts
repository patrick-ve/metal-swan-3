/**
 * De kassabon — oat's mission tally (docs/design/oat.md §7.6; decision 27 and 47). Chosen by
 * `MissionDef.tally: 'receipt'` (gameplay.ts); the newspaper (mission-complete.ts) stays for every
 * other mission.
 *
 * 1. A long receipt rolls out of a printer slot at the top (4 lines per second; fire after 30
 *    ticks prints the rest at once): `KASSABON` / `DAGJE UIT - DE BINNENSTAD`, then the mission's
 *    ledger categories with counts and euros (`STATIEGELD 37X € 5,55`, `VIJANDEN 84X`, `BOETE`,
 *    `TOERISTENBELASTING 2X`, …; the fare `RIT NAAR DE RING` last), then the bonus lines
 *    (`BONUS: SNELLE BAAS`, …: legacy points ÷ 500 × the difficulty factor, booked into the budget
 *    as they print), `TOTAAL` (the mission's net), and `SALDO` (the budget now).
 * 2. The stamp drops: `OVERSCHOT` (green, net ≥ € 0) or `TEKORT` (red). Two players: two receipts
 *    side by side, each stamped; the higher net also gets `ZUINIGST`.
 * 3. `PRESS START`; it moves on by itself 600 ticks after the page finished. Then the next
 *    mission's card (flow.ts `missionDone`), as after the newspaper.
 *
 * The points of the bonus lines still count into the score (the score keeps counting: §7.10).
 */
import type { Color } from '../../engine/color';
import { measure } from '../../engine/font';
import { INK, PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, uiText, type GameApp } from '../app';
import { bonusCents, withDifficulty } from '../budget/euro-table';
import { euroText } from '../budget/format';
import { bookSlot } from '../budget/pay';
import { BUDGET_CATEGORIES, BUDGET_CATEGORY, type BudgetCategory } from '../budget/types';
import { getCharacter } from '../registry';
import type { PlayerSlot } from '../session';
import { CALLOUTS } from './flow-data';
import { missionDone, recordMissionClear } from './flow';
import { tallyLines, TALLY_AUTO_TICKS, type NextRunner } from './mission-complete';

/** One printed row of a receipt. */
export interface ReceiptRow {
  kind: 'title' | 'head' | 'line' | 'rule' | 'bonus' | 'total' | 'saldo' | 'blank' | 'stamp';
  label: string;
  /** Signed cents (null = no amount). */
  cents: number | null;
  /** A bonus row: the points it also counts into the score. */
  points?: number;
}

/** One player's receipt. */
export interface Receipt {
  slot: PlayerSlot;
  rows: ReceiptRow[];
  /** The mission's net with the bonuses (the TOTAAL): ≥ 0 OVERSCHOT, < 0 TEKORT. */
  net: number;
  /** The budget after the bonuses (the SALDO). */
  saldo: number;
  /** 2P: this receipt has the higher net (the `ZUINIGST` stamp). */
  thrift: boolean;
}

/** The receipt's own wording of the newspaper's bonus lines (Dutch, as the till prints it). */
const BONUS_LABEL: readonly (readonly [string, string])[] = [
  ['HOSTAGES', 'GIJZELAARS'],
  ['STANDING OVATION', 'STAANDE OVATIE'],
  ['FLAWLESS', 'FOUTLOOS'],
  ['BOSS SPEED', 'SNELLE BAAS'],
  ['VEHICLE', 'VOERTUIG HEEL'],
  ['NO SCRATCHES', 'GEEN KRASJE'],
];

function bonusLabel(label: string): string {
  for (const [en, nl] of BONUS_LABEL) if (label.startsWith(en)) return `BONUS: ${nl}`;
  return `BONUS: ${label}`;
}

/** Categories the receipt prints in its own place (the bonuses below the line, the fare last). */
const OWN_PLACE: ReadonlySet<BudgetCategory> = new Set<BudgetCategory>(['bonus', 'fare']);

/** A category row: `STATIEGELD 37X` with the summed euros (one item: no count). */
function categoryRow(slot: PlayerSlot, cat: BudgetCategory): ReceiptRow | null {
  const t = slot.ledger.tally(cat);
  if (t.count === 0 && t.cents === 0) return null;
  return { kind: 'line', label: t.count > 1 ? `${BUDGET_CATEGORY[cat]} ${t.count}X` : BUDGET_CATEGORY[cat], cents: t.cents };
}

/**
 * The receipt of one slot (pure: reads the ledger and the tally, books nothing). `mul` = the
 * difficulty factor of the bonuses.
 */
export function buildReceipt(runner: NextRunner, slot: PlayerSlot, mul: number): Receipt {
  const rows: ReceiptRow[] = [
    { kind: 'title', label: 'KASSABON', cents: null },
    { kind: 'head', label: 'DAGJE UIT - DE BINNENSTAD', cents: null },
    { kind: 'rule', label: '', cents: null },
  ];
  for (const cat of BUDGET_CATEGORIES) {
    if (OWN_PLACE.has(cat)) continue;
    const row = categoryRow(slot, cat);
    if (row) rows.push(row);
  }
  const fare = categoryRow(slot, 'fare');
  if (fare) rows.push(fare);
  // The bonuses booked earlier this mission (none in a normal play) stay on one line.
  const earlier = categoryRow(slot, 'bonus');
  if (earlier) rows.push(earlier);
  let bonus = 0;
  const tally = tallyLines(runner, runner.session, slot);
  const bonusRows: ReceiptRow[] = [];
  for (const l of tally.lines) {
    if (l.points === null) continue;
    const cents = withDifficulty(l.cents ?? bonusCents(l.points), mul);
    if (cents === 0) continue;
    bonus += cents;
    bonusRows.push({ kind: 'bonus', label: bonusLabel(l.label), cents, points: Math.round(l.points * mul) });
  }
  // A rule between the parts (never two in a row: a mission with nothing booked).
  const rule = (): void => {
    if (rows[rows.length - 1].kind !== 'rule') rows.push({ kind: 'rule', label: '', cents: null });
  };
  if (bonusRows.length) {
    rule();
    rows.push(...bonusRows);
  }
  const net = slot.ledger.missionNet + bonus;
  const saldo = slot.cents + bonus;
  rule();
  rows.push({ kind: 'total', label: 'TOTAAL', cents: net }, { kind: 'blank', label: '', cents: null }, { kind: 'saldo', label: 'SALDO', cents: saldo });
  return { slot, rows, net, saldo, thrift: false };
}

/** Timing (ticks from the scene start). */
const PRINT_AT = 30;
/** 4 lines per second (spec §7.6). */
const LINE_TICKS = 15;
const STAMP_AFTER = 20;
const STAMP_FALL = 8;
/** Fire skips after this many ticks. */
const SKIP_AFTER = 30;

/** Layout: the printer at the top, the receipts under it (1P centred; 2P side by side). */
const PRINTER_Y = 4;
const PRINTER_H = 12;
const PAPER_W = 168;
const PAPER_TOP = PRINTER_Y + PRINTER_H - 2;
const ROW_H = 9;
const PAD = 6;
/** The paper may grow down to this y; then it scrolls up through the slot. */
const PAPER_BOTTOM = 196;

const plain: DrawOpts = { screen: true };

export class ReceiptTallyScene implements Scene {
  private readonly app: GameApp;
  readonly runner: NextRunner;
  private receipts: Receipt[] = [];
  /** Per receipt: the printed rows (split into lines that fit) and how many were booked. */
  private lines: { row: ReceiptRow; text: string; amount: string; wrap: boolean }[][] = [];
  private booked: number[] = [];
  private t = 0;
  private leaving = false;
  private mul = 1;
  private doneAt = -1;
  /** The tick the last row printed (−1 = still printing). */
  private printedAt = -1;

  constructor(app: GameApp, runner: NextRunner) {
    this.app = app;
    this.runner = runner;
  }

  /** Rows printed so far (the same clock for both receipts). */
  get rowsShown(): number {
    return this.t < PRINT_AT ? 0 : Math.floor((this.t - PRINT_AT) / LINE_TICKS) + 1;
  }

  private get rowCount(): number {
    return this.lines.reduce((n, l) => Math.max(n, l.length), 0);
  }

  /** True once the stamps are down. */
  get finished(): boolean {
    return this.doneAt >= 0;
  }

  /** The receipts on the page (tests read them). */
  get page(): readonly Receipt[] {
    return this.receipts;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    app.pointerPressed = false;
    const session = this.runner.session;
    this.mul = session.mods.tallyScore;
    this.receipts = session.slots.filter((s) => s.joined).map((slot) => buildReceipt(this.runner, slot, this.mul));
    if (this.receipts.length > 1) {
      const best = Math.max(...this.receipts.map((r) => r.net));
      for (const r of this.receipts) r.thrift = r.net === best;
    }
    // The stamps' own place at the foot of each receipt (2 rows; 3 with ZUINIGST in 2P).
    const room = this.receipts.length > 1 ? 3 : 2;
    for (const rc of this.receipts) for (let i = 0; i < room; i++) rc.rows.push({ kind: 'stamp', label: '', cents: null });
    this.lines = this.receipts.map((rc) => layout(rc));
    this.booked = this.receipts.map(() => 0);
    recordMissionClear(this.app, this.runner);
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = app.input;
    const skip = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.pad(1).pressed('fire') || k.keyPressed('Enter') || app.pointerPressed;
    app.pointerPressed = false;
    const rows = this.rowCount;
    const shown = this.rowsShown;
    if (this.printedAt < 0 && this.t >= PRINT_AT && (this.t - PRINT_AT) % LINE_TICKS === 0 && shown <= rows) app.audio.sfx(shown === rows ? 'ui/tally-end' : 'ui/tally-tick');
    this.bookUpTo(Math.min(shown, rows));
    if (this.printedAt < 0 && shown >= rows) this.printedAt = this.t;
    if (this.printedAt >= 0 && this.t === this.printedAt + STAMP_AFTER + STAMP_FALL) app.audio.sfx('ui/stamp');
    if (this.doneAt < 0 && this.printedAt >= 0 && this.t >= this.printedAt + STAMP_AFTER + STAMP_FALL) this.doneAt = this.t;
    if (skip && this.t > SKIP_AFTER) {
      if (this.doneAt < 0) {
        // The first press prints the rest and drops the stamps.
        this.t = Math.max(this.t, PRINT_AT + rows * LINE_TICKS);
        this.bookUpTo(rows);
        this.printedAt = this.t - STAMP_AFTER - STAMP_FALL;
        this.doneAt = this.t;
        return;
      }
      if (this.t - this.doneAt > 10) this.next();
      return;
    }
    if (this.doneAt >= 0 && this.t >= Math.max(TALLY_AUTO_TICKS, this.doneAt + 60)) this.next();
  }

  /** Book every bonus row printed so far (once each): its cents into the budget, its points into the score. */
  private bookUpTo(n: number): void {
    for (let i = 0; i < this.receipts.length; i++) {
      const lines = this.lines[i];
      const slot = this.receipts[i].slot;
      for (let j = this.booked[i]; j < Math.min(n, lines.length); j++) {
        const row = lines[j].row;
        if (row.kind !== 'bonus' || lines[j].wrap || row.cents === null) continue;
        if (row.points) slot.addScore(row.points);
        if (bookSlot(slot, row.cents, 'bonus') > 0) {
          this.app.audio.sfx('item/1up');
          this.app.audio.voice(CALLOUTS.oneMoreTry);
        }
      }
      this.booked[i] = Math.max(this.booked[i], Math.min(n, lines.length));
    }
  }

  private next(): void {
    this.leaving = true;
    this.bookUpTo(this.rowCount);
    for (const r of this.receipts) r.slot.rescued = 0;
    if (this.runner.afterTally) this.runner.afterTally(this.app, this);
    else missionDone(this.app, this.runner);
  }

  draw(r: Renderer): void {
    r.begin(PAL.navy[0]);
    const two = this.receipts.length > 1;
    for (let i = 0; i < this.receipts.length; i++) {
      const x = two ? (i === 0 ? 16 : 200) : (r.w - PAPER_W) >> 1;
      this.drawReceipt(r, i, x);
    }
    if (this.doneAt >= 0 && blinkOn(this.t - this.doneAt)) uiText(r, 'PRESS START', r.w >> 1, 204, PAL.gold[3], 'center');
  }

  private drawReceipt(r: Renderer, i: number, x: number): void {
    const rc = this.receipts[i];
    const lines = this.lines[i];
    const n = Math.min(this.rowsShown, lines.length);
    // The paper grows out of the slot; once it is longer than the screen it scrolls up.
    const h = PAD + n * ROW_H + PAD;
    const scroll = Math.max(0, PAPER_TOP + h - PAPER_BOTTOM);
    const top = PAPER_TOP - scroll;
    if (n > 0) {
      r.rect(x, top, PAPER_W, h, PAL.snow[3], plain);
      r.rect(x + PAPER_W, top + 2, 2, h, PAL.navy[1], plain);
      // The torn bottom edge: a small zigzag.
      for (let k = 0; k < PAPER_W; k += 4) r.rect(x + k, top + h, 2, 2, PAL.snow[3], plain);
      let y = top + PAD;
      for (let j = 0; j < n; j++) {
        this.drawRow(r, lines[j], x, y);
        y += ROW_H;
      }
    }
    // The printer: a dark body with the slot, drawn over the paper's top.
    r.rect(x - 6, PRINTER_Y, PAPER_W + 12, PRINTER_H, PAL.stone[0], plain);
    r.rect(x - 6, PRINTER_Y, PAPER_W + 12, 1, PAL.stone[1], plain);
    r.rect(x - 2, PRINTER_Y + PRINTER_H - 3, PAPER_W + 4, 2, INK, plain);
    const head = `${rc.slot.index === 0 ? '1P' : '2P'} ${getCharacter(rc.slot.character).name}`;
    uiText(r, head, x, PRINTER_Y + 2, rc.slot.index === 0 ? PAL.sky[3] : PAL.gold[3], 'left', 'small', null);
    this.drawStamp(r, rc, x, top, n);
  }

  private drawRow(r: Renderer, l: { row: ReceiptRow; text: string; amount: string; wrap: boolean }, x: number, y: number): void {
    const left = x + PAD;
    const right = x + PAPER_W - PAD;
    switch (l.row.kind) {
      case 'title':
        uiText(r, l.text, x + (PAPER_W >> 1), y - 1, INK, 'center', 'small', null);
        return;
      case 'head':
        uiText(r, l.text, x + (PAPER_W >> 1), y, PAL.stone[1], 'center', 'small', null);
        return;
      case 'rule':
        for (let k = left; k < right; k += 3) r.rect(k, y + 3, 2, 1, PAL.stone[2], plain);
        return;
      case 'blank':
      case 'stamp':
        return;
    }
    const bold = l.row.kind === 'total' || l.row.kind === 'saldo';
    if (l.text) uiText(r, l.text, left, y, bold ? INK : PAL.stone[0], 'left', 'small', null);
    if (l.amount) uiText(r, l.amount, right, y, (l.row.cents ?? 0) < 0 ? PAL.red[1] : INK, 'right', 'small', null);
  }

  /** The stamp drops on the receipt once it is printed: OVERSCHOT / TEKORT, and ZUINIGST (2P). */
  private drawStamp(r: Renderer, rc: Receipt, x: number, top: number, n: number): void {
    if (this.printedAt < 0) return;
    const t = this.t - this.printedAt - STAMP_AFTER;
    if (t < 0) return;
    const word = rc.net >= 0 ? 'OVERSCHOT' : 'TEKORT';
    const col: Color = rc.net >= 0 ? PAL.green[1] : PAL.red[1];
    const w = measure(word, 'big') + 10;
    const cx = x + (PAPER_W >> 1);
    // In its own place at the foot of the receipt (the 'stamp' rows), dropping from above.
    const lines = this.lines[this.receipts.indexOf(rc)];
    let first = lines.findIndex((l) => l.row.kind === 'stamp');
    if (first < 0 || first > n) first = n;
    const restY = top + PAD + first * ROW_H + 1;
    const y = t < STAMP_FALL ? restY - (STAMP_FALL - t) * 6 : restY;
    r.rect(cx - (w >> 1), y, w, 16, col, plain);
    r.rect(cx - (w >> 1) + 2, y + 2, w - 4, 12, PAL.snow[3], plain);
    uiText(r, word, cx, y + 4, col, 'center', 'big', null);
    if (rc.thrift && t >= STAMP_FALL) {
      const zw = measure('ZUINIGST') + 8;
      r.rect(cx - (zw >> 1), y + 18, zw, 11, PAL.gold[1], plain);
      uiText(r, 'ZUINIGST', cx, y + 20, INK, 'center', 'small', null);
    }
  }
}

/**
 * The printed lines of a receipt: a row whose label and amount do not fit the paper prints the
 * amount on its own line below (right-aligned).
 */
function layout(rc: Receipt): { row: ReceiptRow; text: string; amount: string; wrap: boolean }[] {
  const out: { row: ReceiptRow; text: string; amount: string; wrap: boolean }[] = [];
  const room = PAPER_W - 2 * PAD;
  for (const row of rc.rows) {
    const amount = row.cents === null ? '' : euroText(row.cents);
    if (amount && measure(row.label) + 6 + measure(amount) > room) {
      // The first part (the label) never books; the amount line carries the booking.
      out.push({ row, text: row.label, amount: '', wrap: true });
      out.push({ row, text: '', amount, wrap: false });
    } else out.push({ row, text: row.label, amount, wrap: false });
  }
  return out;
}
