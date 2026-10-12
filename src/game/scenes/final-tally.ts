/**
 * Final tally after the ending and the credits (GDD §14.6), per player: LIVES LEFT (lives in
 * reserve × 50,000), ALL GOLDEN RECORDS (100,000 for the golden record of all 5 missions),
 * ONE-TAKE WONDER (500,000 with no continue used) and CONTINUES USED (shown, no points), then the
 * total, which counts into the score, and the final score. The GDD gives no layout; this screen
 * follows the newspaper tally (§13.11): `FINAL TALLY` (big, gold, C, y 16), a column per player
 * (P1 from x 24, P2 from x 200; one player: centred), a line every 30 ticks with `ui/tally-tick`,
 * the total with `ui/tally-end`, `PRESS START` (C, y 206); it moves on by itself after 600
 * ticks; the credits song plays on. Then name entry (if the score qualifies), the high scores and the
 * title.
 */
import type { Color } from '../../engine/color';
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, drawPanel, PLAYER_COLORS, scoreText, uiText, UI_GOLD, UI_WHITE, type CampaignRecord, type GameApp } from '../app';
import { getCharacter } from '../registry';
import type { PlayerSlot } from '../session';
import { CALLOUTS } from './flow-data';
import { finishGame } from './flow';
import { drawLake, veil } from './lake';

/** GDD §14.6 values. */
export const FINAL_TALLY = {
  perLife: 50000,
  allGoldenRecords: 100000,
  oneTake: 500000,
} as const;

/** The campaign's five missions (ALL GOLDEN RECORDS needs each one's record). */
export const CAMPAIGN_MISSIONS: readonly string[] = ['m1', 'm2', 'm3', 'm4', 'm5'];

export interface FinalLine {
  label: string;
  /** Points, or null for a missed bonus (`---`); `note` replaces the points (CONTINUES USED). */
  points: number | null;
  note?: string;
}

/** The final tally lines of one slot and their total. */
export function finalTallyLines(slot: PlayerSlot, campaign: CampaignRecord | null): { lines: FinalLine[]; total: number } {
  const reserve = Math.max(0, slot.lives - 1);
  const records = campaign?.goldenRecords[slot.index];
  const allRecords = records !== undefined && CAMPAIGN_MISSIONS.every((id) => records.has(id));
  const lines: FinalLine[] = [
    { label: `LIVES LEFT ${reserve} X ${FINAL_TALLY.perLife}`, points: reserve * FINAL_TALLY.perLife },
    { label: 'ALL GOLDEN RECORDS', points: allRecords ? FINAL_TALLY.allGoldenRecords : null },
    { label: 'ONE-TAKE WONDER', points: slot.continues === 0 ? FINAL_TALLY.oneTake : null },
    { label: 'CONTINUES USED', points: null, note: String(slot.continues) },
  ];
  return { lines, total: lines.reduce((a, l) => a + (l.points ?? 0), 0) };
}

interface Column {
  slot: PlayerSlot;
  lines: FinalLine[];
  total: number;
  paid: number;
}

const LINES_AT = 40;
const LINE_TICKS = 30;
/** Moves on by itself after this many ticks (as the mission tally). */
export const FINAL_AUTO_TICKS = 600;
const ROW_Y = 64;
const ROW_STEP = 14;
const COL_W = 160;

export class FinalTallyScene implements Scene {
  private readonly app: GameApp;
  private cols: Column[] = [];
  private t = 0;
  private doneAt = -1;
  private leaving = false;

  constructor(app: GameApp) {
    this.app = app;
  }

  /** Lines shown per column (the bonus lines, then TOTAL). */
  get rowsShown(): number {
    return this.t < LINES_AT ? 0 : Math.floor((this.t - LINES_AT) / LINE_TICKS) + 1;
  }

  enter(): void {
    this.app.input.suppress();
    this.app.pointerPressed = false;
    const slots = this.app.session?.slots.filter((s) => s.joined) ?? [];
    this.cols = slots.map((slot) => ({ slot, ...finalTallyLines(slot, this.app.campaign), paid: 0 }));
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = app.input;
    const press = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.pad(1).pressed('fire') || k.keyPressed('Enter');
    const rows = 5;
    const shown = this.rowsShown;
    if (this.t >= LINES_AT && (this.t - LINES_AT) % LINE_TICKS === 0 && shown <= rows) app.audio.sfx(shown === rows ? 'ui/tally-end' : 'ui/tally-tick');
    if (shown >= rows) this.payOut(false);
    if (this.doneAt < 0 && shown >= rows && this.cols.every((c) => c.paid >= c.total)) this.doneAt = this.t;
    if (press && this.t > 20) {
      if (this.doneAt < 0) {
        this.t = Math.max(this.t, LINES_AT + rows * LINE_TICKS);
        this.payOut(true);
        this.doneAt = this.t;
      } else if (this.t - this.doneAt > 10) this.next();
      return;
    }
    if (this.doneAt >= 0 && this.t >= Math.max(FINAL_AUTO_TICKS, this.doneAt + 60)) this.next();
  }

  private payOut(all: boolean): void {
    for (const c of this.cols) {
      if (c.paid >= c.total) continue;
      const step = all ? c.total - c.paid : Math.min(c.total - c.paid, Math.max(500, Math.ceil(c.total / 60)));
      c.paid += step;
      if (c.slot.addScore(step) > 0) {
        this.app.audio.sfx('item/1up');
        this.app.audio.voice(CALLOUTS.oneMoreTry);
      }
    }
  }

  private next(): void {
    this.leaving = true;
    this.payOut(true);
    finishGame(this.app, true);
  }

  draw(r: Renderer): void {
    r.begin(PAL.navy[0]);
    drawLake(r, 2000 + this.t);
    veil(r, 0.6);
    centerText(r, 'FINAL TALLY', 16, UI_GOLD, 'big');
    centerText(r, 'THE WHOLE PERFORMANCE', 30, PAL.snow[2]);
    const two = this.cols.length > 1;
    for (let i = 0; i < this.cols.length; i++) this.drawColumn(r, this.cols[i], two ? (i === 0 ? 24 : 200) : 112);
    if (this.doneAt >= 0 && blinkOn(this.t - this.doneAt)) centerText(r, 'PRESS START', 206, UI_WHITE);
  }

  private drawColumn(r: Renderer, c: Column, x0: number): void {
    const p1 = c.slot.index === 0;
    const col: Color = PLAYER_COLORS[c.slot.index];
    drawPanel(r, x0 - 6, 44, COL_W + 12, 150, 0.85);
    uiText(r, `${p1 ? '1P' : '2P'} ${getCharacter(c.slot.character).name}`, x0, 50, col);
    const shown = this.rowsShown;
    let y = ROW_Y;
    for (let k = 0; k < c.lines.length && k < shown; k++) {
      const l = c.lines[k];
      uiText(r, l.label, x0, y, UI_WHITE);
      const missed = l.points === null && !l.note;
      uiText(r, l.note ?? (l.points === null ? '---' : String(l.points)), x0 + COL_W, y, missed ? PAL.stone[2] : UI_WHITE, 'right');
      y += ROW_STEP;
    }
    if (shown <= c.lines.length) return;
    r.rect(x0, y - 4, COL_W, 1, PAL.ui[2], { screen: true });
    uiText(r, 'TOTAL', x0, y, UI_GOLD);
    uiText(r, String(c.paid), x0 + COL_W, y, UI_GOLD, 'right');
    y += 22;
    uiText(r, 'FINAL SCORE', x0, y, PAL.snow[2]);
    uiText(r, scoreText(c.slot.score), x0 + COL_W, y + 12, UI_GOLD, 'right', 'big');
  }
}
