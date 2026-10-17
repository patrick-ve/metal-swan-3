/**
 * FpsTallyScene (docs/design/fps.md §1.8, §4.12): the floor tally of the first-person mode. Its
 * own page: a dark steel panel, `<FLOOR NAME> CLEARED` (big, gold), `FLOOR n`, then one column —
 * the fps slot's lines (its `1P` / `2P` tag top right):
 *
 * KILLS n% (10,000 at 100 %), SECRETS a/b (10,000 when all found), TREASURE n% (10,000 at 100 %),
 * TIME m:ss PAR m:ss ((par − seconds) × 500 under par), the MISSION 1 BONUS info lines on floor 1
 * (paid at the bridge; not in TOTAL), DIFFICULTY (× 0.5 / 1.0 / 1.5), TOTAL (counted into the
 * score; extends apply).
 *
 * A line every 30 ticks with `ui/tally-tick`, TOTAL with `ui/tally-end`, `fps/tally-100` under a
 * 100 % ratio. PRESS START: the first press shows the page and pays out; it moves on by itself
 * 600 ticks after it opened. `enter` records the floor (campaign, golden record, completed).
 */
import type { Color } from '../../engine/color';
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, drawPanel, PLAYER_COLORS, uiText, type GameApp } from '../app';
import { fpsFloorByNumber, fpsFloorId } from '../fps/registry';
import { AMS_BONUS_KEY } from '../fps/run';
import type { FloorResult, FpsRun } from '../fps/types';
import type { PlayerSlot } from '../session';
import { fpsTallyDone } from './fps-route';

/** Points of the 100 % lines and the time bonus per second under par (§4.12). */
export const TALLY_RATIO_POINTS = 10000;
export const TALLY_PAR_POINTS = 500;
/** Timing (same as the ams newspaper where it fits). */
export const FPS_TALLY_LINES_AT = 40;
export const FPS_TALLY_LINE_TICKS = 30;
export const FPS_TALLY_AUTO_TICKS = 600;

/** One tally line: `value` is the shown figure (KILLS 87%), `points` the bonus (null = info only / none). */
export interface FpsTallyLine {
  label: string;
  value: string;
  points: number | null;
  /** The line counts into TOTAL (info lines do not). */
  counts: boolean;
  /** A 100 % ratio (the `fps/tally-100` sound). */
  perfect?: boolean;
  /** Draw colour of the label (the waiting slot's tag colour), else white. */
  color?: Color;
}

export interface FpsTally {
  lines: FpsTallyLine[];
  /** Sum of the counted lines before the difficulty. */
  raw: number;
  /** raw × the difficulty multiplier, rounded. */
  total: number;
  killPct: number;
  treasurePct: number;
  seconds: number;
}

/** A ratio in whole percent, rounded down, at most 100 (no items / enemies: 100). */
export function ratioPct(n: number, total: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.floor((n * 100) / total));
}

/** Floor time in whole seconds, rounded up (§4.12). */
export function tallySeconds(ticks: number): number {
  return Math.ceil(Math.max(0, ticks) / 60);
}

/** m:ss */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface TallyOpts {
  /** Par time in seconds. */
  par: number;
  /** session.mods.tallyScore. */
  mul: number;
  /** The fps slot's index (0 / 1). */
  slot: number;
  /** The MISSION 1 BONUS amounts [p1, p2] (floor 1 only; undefined = no line). */
  amsBonus?: readonly [number, number];
  /** The waiting slot is joined (its MISSION 1 BONUS info line follows). */
  otherJoined?: boolean;
}

/** The tally of one floor (pure; §4.12). */
export function fpsTally(r: FloorResult, o: TallyOpts): FpsTally {
  const killPct = ratioPct(r.kills, r.killsTotal);
  const treasurePct = ratioPct(r.treasure, r.treasureTotal);
  const allSecrets = r.secrets >= r.secretsTotal;
  const seconds = tallySeconds(r.ticks);
  const lines: FpsTallyLine[] = [
    { label: 'KILLS', value: `${killPct}%`, points: killPct >= 100 ? TALLY_RATIO_POINTS : 0, counts: true, perfect: killPct >= 100 },
    { label: 'SECRETS', value: `${r.secrets}/${r.secretsTotal}`, points: allSecrets ? TALLY_RATIO_POINTS : 0, counts: true, perfect: allSecrets && r.secretsTotal > 0 },
    { label: 'TREASURE', value: `${treasurePct}%`, points: treasurePct >= 100 ? TALLY_RATIO_POINTS : 0, counts: true, perfect: treasurePct >= 100 },
    {
      label: 'TIME',
      value: `${clockText(seconds)}  PAR ${clockText(o.par)}`,
      points: seconds < o.par ? (o.par - seconds) * TALLY_PAR_POINTS : 0,
      counts: true,
    },
  ];
  if (o.amsBonus) {
    const own = o.slot === 1 ? 1 : 0;
    lines.push({ label: 'MISSION 1 BONUS', value: '', points: o.amsBonus[own] ?? 0, counts: false });
    if (o.otherJoined) {
      const other = 1 - own;
      lines.push({ label: `${other === 0 ? '1P' : '2P'} MISSION 1 BONUS`, value: '', points: o.amsBonus[other] ?? 0, counts: false, color: PLAYER_COLORS[other] });
    }
  }
  let raw = 0;
  for (const l of lines) if (l.counts && l.points) raw += l.points;
  const total = Math.round(raw * o.mul);
  lines.push({ label: 'DIFFICULTY', value: `X${o.mul.toFixed(1)}`, points: null, counts: false });
  lines.push({ label: 'TOTAL', value: '', points: total, counts: false });
  return { lines, raw, total, killPct, treasurePct, seconds };
}

const PANEL_X = 40;
const PANEL_Y = 8;
const PANEL_W = 304;
const PANEL_H = 188;
const ROW_Y = 46;
const ROW_STEP = 14;
const LABEL_X = 64;
const VALUE_X = 196;
const POINTS_X = 320;

const plain: DrawOpts = { screen: true };

export class FpsTallyScene implements Scene {
  readonly app: GameApp;
  readonly run: FpsRun;
  readonly result: FloorResult;
  readonly tally: FpsTally;
  readonly slot: PlayerSlot;
  private readonly name: string;
  private t = 0;
  private paid = 0;
  /** Lines whose sound played. */
  private sounded = 0;
  private leaving = false;
  /** Tick at which every line was up and the total paid (-1 = not yet). */
  private doneAt = -1;

  constructor(app: GameApp, run: FpsRun, result: FloorResult) {
    this.app = app;
    this.run = run;
    this.result = result;
    const session = app.session;
    const def = fpsFloorByNumber(result.floor);
    this.name = def?.name ?? `FLOOR ${result.floor}`;
    const slotIndex = run.slot;
    this.slot = session ? session.slots[slotIndex] : (null as unknown as PlayerSlot);
    const bonus = result.floor === 1 ? session?.records.get<readonly [number, number]>(AMS_BONUS_KEY) : undefined;
    this.tally = fpsTally(result, {
      par: def?.par ?? 0,
      mul: session?.mods.tallyScore ?? 1,
      slot: slotIndex,
      amsBonus: bonus,
      otherJoined: session ? session.slots[1 - slotIndex].joined : false,
    });
  }

  /** Lines shown so far. */
  get rowsShown(): number {
    return this.t < FPS_TALLY_LINES_AT ? 0 : Math.min(this.tally.lines.length, Math.floor((this.t - FPS_TALLY_LINES_AT) / FPS_TALLY_LINE_TICKS) + 1);
  }

  /** Every line is up and the total is paid. */
  get finished(): boolean {
    return this.doneAt >= 0;
  }

  /** Points paid into the score so far. */
  get paidOut(): number {
    return this.paid;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    app.pointerPressed = false;
    app.audio.music('fps-tally');
    this.record();
  }

  /** The floor is done: campaign record, golden record, completed list (§1.8). */
  private record(): void {
    const id = fpsFloorId(this.result.floor);
    const camp = this.app.campaign;
    if (camp) {
      if (!camp.missions.includes(id)) camp.missions.push(id);
      if (this.result.goldenRecord) camp.goldenRecords[this.run.slot].add(id);
    }
    const session = this.app.session;
    if (session && !session.completed.includes(id)) session.completed.push(id);
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = app.input;
    const skip = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.pad(1).pressed('fire') || k.keyPressed('Enter') || k.keyPressed('Space') || app.pointerPressed;
    app.pointerPressed = false;
    const lines = this.tally.lines;
    const n = lines.length;
    const shown = this.rowsShown;
    if (shown > this.sounded && this.doneAt < 0) {
      this.sounded = shown;
      app.audio.sfx(shown === n ? 'ui/tally-end' : 'ui/tally-tick');
      if (lines[shown - 1]?.perfect) app.audio.sfx('fps/tally-100');
    }
    if (this.rowsShown >= n) this.payOut(false);
    if (this.doneAt < 0 && this.rowsShown >= n && this.paid >= this.tally.total) this.doneAt = this.t;
    if (skip && this.t > 20) {
      if (this.doneAt < 0) {
        // The first press shows the whole page and pays out the rest at once.
        this.t = Math.max(this.t, FPS_TALLY_LINES_AT + n * FPS_TALLY_LINE_TICKS);
        this.payOut(true);
        this.doneAt = this.t;
        this.sounded = n;
        return;
      }
      if (this.t - this.doneAt > 10) this.next();
      return;
    }
    if (this.t >= FPS_TALLY_AUTO_TICKS) this.next();
  }

  /** Count TOTAL into the score (a step per tick, or all at once); extends apply. */
  private payOut(all: boolean): void {
    const total = this.tally.total;
    if (this.paid >= total || !this.slot) return;
    const step = all ? total - this.paid : Math.min(total - this.paid, Math.max(100, Math.ceil(total / 60)));
    this.paid += step;
    if (this.slot.addScore(step) > 0) this.app.audio.sfx('item/1up');
  }

  private next(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.payOut(true);
    // The next floor starts from the score after the tally (a restart there resets to it).
    if (this.slot) this.run.floorStartScore = this.slot.score;
    fpsTallyDone(this.app, this.run);
  }

  draw(r: Renderer): void {
    r.begin(PAL.ink[0]);
    drawPanel(r, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
    // Steel rivets in the corners.
    for (const [x, y] of [
      [PANEL_X + 4, PANEL_Y + 4],
      [PANEL_X + PANEL_W - 6, PANEL_Y + 4],
      [PANEL_X + 4, PANEL_Y + PANEL_H - 6],
      [PANEL_X + PANEL_W - 6, PANEL_Y + PANEL_H - 6],
    ] as const)
      r.rect(x, y, 2, 2, PAL.steel[2], plain);
    centerText(r, `${this.name} CLEARED`, 16, PAL.gold[3], 'big');
    centerText(r, `FLOOR ${this.result.floor}`, 30, PAL.stone[3]);
    const slot = this.run.slot;
    uiText(r, slot === 1 ? '2P' : '1P', PANEL_X + PANEL_W - 8, PANEL_Y + 6, PLAYER_COLORS[slot] ?? PAL.sky[3], 'right');
    const lines = this.tally.lines;
    const shown = this.rowsShown;
    for (let i = 0; i < shown && i < lines.length; i++) {
      const l = lines[i];
      const y = ROW_Y + i * ROW_STEP;
      const total = l.label === 'TOTAL';
      const info = !l.counts && l.points !== null && !total;
      const col = total ? PAL.gold[3] : l.color ?? (info ? PAL.stone[3] : PAL.snow[3]);
      if (total) r.rect(LABEL_X, y - 4, POINTS_X - LABEL_X, 1, PAL.steel[2], plain);
      uiText(r, l.label, LABEL_X, y, col);
      if (l.value) uiText(r, l.value, VALUE_X, y, l.perfect ? PAL.gold[3] : PAL.snow[2]);
      const pts = total ? this.paid : l.points;
      if (pts !== null) uiText(r, pts > 0 || total || info ? fmt(pts) : '---', POINTS_X, y, total ? PAL.gold[3] : PAL.snow[2], 'right');
    }
    if (this.finished && blinkOn(this.t)) centerText(r, 'PRESS START', 206, PAL.snow[3]);
  }
}

/** 12,345 */
function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
