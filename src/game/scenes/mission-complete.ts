/**
 * Mission complete — "THE REVIEWS ARE IN" (GDD §13.11, §14.4). The level already showed
 * `MISSION COMPLETE!` with the victory poses and the jingle (MissionRunner); this scene is the
 * newspaper that follows:
 *
 * 1. The page (`ui/newspaper`) slides up. Masthead (big, C, y 16) `THE LOWMERE LISTENER`, under it
 *    (small) `SPECIAL EDITION`; the rubber stamp (`ui/stamp`) drops the mission's headline (small,
 *    C, y 44; the mission card's `headline`).
 * 2. The tally lines (small; P1 column from x 24, P2 column from x 200), one every 30 ticks with
 *    `ui/tally-tick`: HOSTAGES (n × 10,000), STANDING OVATION, FLAWLESS PERFORMANCE, BOSS SPEED
 *    BONUS, VEHICLE AT THE FINISH, NO SCRATCHES (missed bonuses show `---`), Pip's HATS COLLECTED
 *    (no points), DIFFICULTY (×0.5 / ×1.0 / ×1.5), then TOTAL with `ui/tally-end` while the total
 *    counts into the score.
 * 3. THE CRITICS SAY: a star rating per player (`ui/star` per star; 1 + one for each of ≥ 75 % of
 *    the route's hostages, no life lost, a boss speed bonus, the golden record) and the quote.
 * 4. `PRESS START` (C, y 206); it moves on by itself 600 ticks after the page opened. The next
 *    mission's intro card follows, or the ending after the last mission (flow.ts `missionDone`).
 */
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { frameW, getFrame, hasSprite } from '../../engine/sprites';
import { blinkOn, uiText, type GameApp } from '../app';
import { wrapText } from '../context';
import type { MissionRunner } from '../mission/runner';
import { getCharacter } from '../registry';
import type { GameSession, PlayerSlot } from '../session';
import { TUNING } from '../tuning';
import { CALLOUTS, CRITIC_QUOTES, missionCard, VOICE } from './flow-data';
import { missionDone } from './flow';

/** One tally line: points, or null for a missed bonus (`---`); `note` replaces the points (HATS). */
export interface TallyLine {
  label: string;
  points: number | null;
  note?: string;
}

export interface SlotTally {
  lines: TallyLine[];
  /** The bonus lines before the difficulty multiplier. */
  raw: number;
  /** THE CRITICS SAY: 1–5. */
  stars: number;
}

/** The infantry whose hats Pip collects (GDD §3: HATS COLLECTED = infantry killed). */
const INFANTRY: readonly string[] = ['rifleman', 'drummer', 'oompah-trooper', 'cymbalist', 'baton-major', 'piccolo', 'triangle', 'bassoonist'];

/** Infantry kills of a mission (outfit variants such as `rifleman-desert` count too). */
export function hatsCollected(kills: Readonly<Record<string, number>>): number {
  let n = 0;
  for (const id in kills) if (INFANTRY.some((t) => id === t || id.startsWith(`${t}-`))) n += kills[id];
  return n;
}

/** Hostages on the route a slot took (MissionDef.hostages per section id; 0 when unknown). */
function routeHostages(runner: MissionRunner, slot: PlayerSlot): number {
  const per = runner.mission.hostages;
  if (!per) return 0;
  let n = 0;
  for (const id of new Set(slot.mission.route)) n += per[id] ?? 0;
  return n;
}

/**
 * BOSS SPEED BONUS (GDD §14.4): max(0, 90 − seconds from the end of the boss intro to its death)
 * × 200, at most 18,000; m5: max(0, 240 − seconds for all three final stages) × 200.
 */
export function bossSpeedBonus(missionId: string, startTick: number, endTick: number): number {
  if (startTick < 0 || endTick < startTick) return 0;
  const S = TUNING.score;
  const limit = missionId === 'm5' ? 240 : S.bossSpeedSeconds;
  const seconds = Math.ceil((endTick - startTick) / 60);
  const cap = missionId === 'm5' ? limit * S.bossSpeedPerSecond : S.bossSpeedMax;
  return Math.min(cap, Math.max(0, limit - seconds) * S.bossSpeedPerSecond);
}

/** The tally lines of one slot (GDD §14.4), before the difficulty line. */
export function tallyLines(runner: MissionRunner, session: GameSession, slot: PlayerSlot): SlotTally {
  const S = TUNING.score;
  const m = slot.mission;
  const lines: TallyLine[] = [];
  lines.push({ label: `HOSTAGES ${slot.rescued} X ${S.hostageBonus}`, points: slot.rescued * S.hostageBonus });
  // STANDING OVATION: 1P every hostage of the route; 2P the two tallies together, 25,000 each.
  const route = routeHostages(runner, slot);
  const joined = session.slots.filter((s) => s.joined);
  const together = joined.reduce((a, s) => a + s.rescued, 0);
  const ovation = route > 0 && (joined.length > 1 ? together >= route : slot.rescued >= route);
  lines.push({ label: 'STANDING OVATION', points: ovation ? (joined.length > 1 ? S.ovation / 2 : S.ovation) : null });
  lines.push({ label: 'FLAWLESS PERFORMANCE', points: m.deaths === 0 ? S.flawless : null });
  const speed = bossSpeedBonus(runner.mission.id, m.bossStartTick, m.bossEndTick);
  lines.push({ label: 'BOSS SPEED BONUS', points: speed > 0 ? speed : null });
  lines.push({ label: 'VEHICLE AT THE FINISH', points: m.vehicleAtFinish ? S.vehicleBossBonus : null });
  lines.push({ label: 'NO SCRATCHES', points: m.noScratches ? S.noScratches : null });
  if (slot.character === 'pip') lines.push({ label: 'HATS COLLECTED', points: null, note: String(hatsCollected(m.kills)) });
  const raw = lines.reduce((a, l) => a + (l.points ?? 0), 0);
  let stars = 1;
  if (route > 0 && slot.rescued >= Math.ceil(route * 0.75)) stars++;
  if (m.deaths === 0) stars++;
  if (speed > 0) stars++;
  if (m.goldenRecord) stars++;
  return { lines, raw, stars: Math.min(5, stars) };
}

interface Column {
  slot: PlayerSlot;
  tally: SlotTally;
  /** Every line on the page: the bonus lines, DIFFICULTY and TOTAL. */
  rows: TallyLine[];
  total: number;
  /** Points counted into the score so far. */
  paid: number;
  quote: string[];
}

/** Page timing (ticks from the scene start). */
const SLIDE_TICKS = 24;
const STAMP_AT = 36;
const STAMP_FALL = 10;
const LINES_AT = 66;
const LINE_TICKS = 30;
const STAR_TICKS = 12;
/** GDD §13.11: the page moves on by itself after 600 ticks. */
export const TALLY_AUTO_TICKS = 600;

/** The page's place on screen (the newspaper art is 360 × 204 with a 3 px shadow). */
const PAGE_X = 12;
const PAGE_Y = 6;
const COL_X: readonly number[] = [24, 200];
const COL_W = 160;
const ROW_Y = 70;
const ROW_STEP = 9;
/** Characters per quote line (about 157 px of small font: at most 2 lines for every quote). */
const QUOTE_CHARS = 29;

const plain: DrawOpts = { screen: true };
const pageOpts: DrawOpts = { screen: true };

export class MissionCompleteScene implements Scene {
  private readonly app: GameApp;
  readonly runner: MissionRunner;
  private cols: Column[] = [];
  private t = 0;
  private leaving = false;
  private mul = 1;
  /** Tick at which the page finished (every line, the totals and the stars shown). */
  private doneAt = -1;
  private headline = '';

  constructor(app: GameApp, runner: MissionRunner) {
    this.app = app;
    this.runner = runner;
  }

  /** Rows shown so far in each column (the same count for both). */
  get rowsShown(): number {
    return this.t < LINES_AT ? 0 : Math.floor((this.t - LINES_AT) / LINE_TICKS) + 1;
  }

  private get rowCount(): number {
    return this.cols.reduce((n, c) => Math.max(n, c.rows.length), 0);
  }

  /** True once the stars and quotes are up. */
  get finished(): boolean {
    return this.doneAt >= 0;
  }

  enter(): void {
    const app = this.app;
    app.input.suppress();
    app.pointerPressed = false;
    const session = this.runner.session;
    this.mul = session.mods.tallyScore;
    this.headline = missionCard(this.runner.mission.id).headline;
    this.cols = session.slots
      .filter((s) => s.joined)
      .map((slot) => {
        const tally = tallyLines(this.runner, session, slot);
        const total = Math.round(tally.raw * this.mul);
        const rows: TallyLine[] = [...tally.lines, { label: 'DIFFICULTY', points: null, note: `X${this.mul.toFixed(1)}` }, { label: 'TOTAL', points: total }];
        // The quote wraps to the column (2 players) or the right half of the page (1 player).
        const quote = wrapText(CRITIC_QUOTES[tally.stars - 1], QUOTE_CHARS, 3);
        return { slot, tally, rows, total, paid: 0, quote };
      });
    this.recordCampaign();
    if (this.cols.some((c) => c.tally.lines[1].points !== null)) app.audio.voice(VOICE.ovation);
  }

  /** The campaign remembers finished missions and golden records (final tally, GDD §14.6). */
  private recordCampaign(): void {
    const camp = this.app.campaign;
    if (!camp) return;
    const id = this.runner.mission.id;
    if (!camp.missions.includes(id)) camp.missions.push(id);
    for (const c of this.cols) if (c.slot.mission.goldenRecord) camp.goldenRecords[c.slot.index].add(id);
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = app.input;
    const skip = k.pad(0).pressed('start') || k.pad(0).pressed('fire') || k.pad(1).pressed('start') || k.pad(1).pressed('fire') || k.keyPressed('Enter') || app.pointerPressed;
    app.pointerPressed = false;
    if (this.t === STAMP_AT + STAMP_FALL) app.audio.sfx('ui/stamp');
    const rows = this.rowCount;
    const shown = this.rowsShown;
    if (this.t >= LINES_AT && (this.t - LINES_AT) % LINE_TICKS === 0 && shown <= rows) app.audio.sfx(shown === rows ? 'ui/tally-end' : 'ui/tally-tick');
    // The total counts into the score once its line is up.
    if (shown >= rows) this.payOut(false);
    const starsFrom = LINES_AT + rows * LINE_TICKS;
    const starsT = this.t - starsFrom;
    if (starsT > 0 && starsT % STAR_TICKS === 0 && this.cols.some((c) => starsT / STAR_TICKS <= c.tally.stars)) app.audio.sfx('ui/star');
    if (this.doneAt < 0 && starsT >= 5 * STAR_TICKS && this.cols.every((c) => c.paid >= c.total)) this.doneAt = this.t;
    if (skip && this.t > 20) {
      if (this.doneAt < 0) {
        // The first press shows the whole page and pays out the rest at once.
        this.t = Math.max(this.t, starsFrom + 5 * STAR_TICKS);
        this.payOut(true);
        this.doneAt = this.t;
        return;
      }
      if (this.t - this.doneAt > 10) this.next();
      return;
    }
    if (this.doneAt >= 0 && this.t >= Math.max(TALLY_AUTO_TICKS, this.doneAt + 60)) this.next();
  }

  /** Count the totals into the scores (a step per tick, or all at once). */
  private payOut(all: boolean): void {
    for (const c of this.cols) {
      if (c.paid >= c.total) continue;
      const step = all ? c.total - c.paid : Math.min(c.total - c.paid, Math.max(100, Math.ceil(c.total / 60)));
      c.paid += step;
      // An extend from the tally (GDD §14.5): the life is added by addScore; the sound and line here.
      if (c.slot.addScore(step) > 0) {
        this.app.audio.sfx('item/1up');
        this.app.audio.voice(CALLOUTS.oneMoreTry);
      }
    }
  }

  private next(): void {
    this.leaving = true;
    this.payOut(true);
    for (const c of this.cols) c.slot.rescued = 0;
    missionDone(this.app, this.runner);
  }

  draw(r: Renderer): void {
    r.begin(PAL.navy[0]);
    // The page slides up from below.
    const k = Math.min(1, this.t / SLIDE_TICKS);
    const dy = Math.round((1 - k * (2 - k)) * (r.h - PAGE_Y));
    if (hasSprite('ui/newspaper')) r.sprite('ui/newspaper', 0, PAGE_X, PAGE_Y + dy, pageOpts);
    else {
      r.rect(PAGE_X, PAGE_Y + dy, 360, 204, PAL.snow[2], plain);
      r.rect(PAGE_X + 10, PAGE_Y + dy + 30, 340, 2, INK, plain);
    }
    if (dy > 0) return;
    inkText(r, 'THE LOWMERE LISTENER', r.w >> 1, 16, INK, 'center', 'big');
    inkText(r, 'SPECIAL EDITION', r.w >> 1, 27, PAL.red[1], 'center');
    this.drawHeadline(r);
    const shown = this.rowsShown;
    for (let i = 0; i < this.cols.length; i++) this.drawColumn(r, this.cols[i], i, shown);
    if (this.doneAt >= 0 && blinkOn(this.t - this.doneAt)) inkText(r, 'PRESS START', r.w >> 1, 200, PAL.red[1], 'center');
  }

  /** The stamp drops, thuds and lifts; the headline is printed where it hit. */
  private drawHeadline(r: Renderer): void {
    const t = this.t - STAMP_AT;
    if (t < 0) return;
    if (t >= STAMP_FALL) inkText(r, this.headline, r.w >> 1, 44, INK, 'center');
    if (!hasSprite('ui/stamp') || t > STAMP_FALL + 20) return;
    // Falling (frame 0), squashed on impact (frame 1), then lifting away.
    const sx = r.w >> 1;
    const y = t < STAMP_FALL ? Math.round(-30 + (52 + 30) * (t / STAMP_FALL)) : t < STAMP_FALL + 6 ? 52 : 52 - (t - STAMP_FALL - 6) * 6;
    r.sprite('ui/stamp', t >= STAMP_FALL && t < STAMP_FALL + 6 ? 1 : 0, sx, y, plain);
  }

  private drawColumn(r: Renderer, c: Column, i: number, shown: number): void {
    const two = this.cols.length > 1;
    const x0 = COL_X[i];
    const right = x0 + COL_W;
    const p1 = c.slot.index === 0;
    const col: Color = p1 ? PAL.sky[1] : PAL.gold[0];
    // The column head: tag and character, with the portrait in 1-player mode on the right page.
    const ch = getCharacter(c.slot.character);
    inkText(r, `${p1 ? '1P' : '2P'} ${ch.name}`, x0, ROW_Y - 11, col);
    let y = ROW_Y + 2;
    for (let k = 0; k < c.rows.length && k < shown; k++) {
      const row = c.rows[k];
      const total = row.label === 'TOTAL';
      if (total) {
        // A rule between DIFFICULTY and TOTAL, 2 px clear of both.
        y += 2;
        r.rect(x0, y - 2, COL_W, 1, INK, plain);
        y += 1;
      }
      inkText(r, row.label, x0, y, INK);
      const value = total ? String(c.paid) : row.note ?? (row.points === null ? '---' : String(row.points));
      inkText(r, value, right, y, total ? PAL.red[1] : row.points === null && !row.note ? PAL.stone[1] : INK, 'right');
      y += ROW_STEP;
    }
    const rows = this.rowCount;
    const starsT = this.t - (LINES_AT + rows * LINE_TICKS);
    if (starsT < 0) return;
    // THE CRITICS SAY (1 player: on the right half of the page; 2 players: under each column).
    const sx = two ? x0 : 204;
    let sy = two ? ROW_Y + 2 + rows * ROW_STEP + 6 : ROW_Y + 2;
    if (!two) this.drawPortrait(r, c, 286, ROW_Y + 56);
    inkText(r, 'THE CRITICS SAY:', sx, sy, PAL.red[1]);
    sy += 10;
    const n = Math.min(c.tally.stars, Math.floor(starsT / STAR_TICKS) + 1);
    for (let s = 0; s < n; s++) {
      if (hasSprite('ui/star')) {
        const f = getFrame('ui/star', 0);
        r.sprite('ui/star', 0, sx + s * (frameW(f) + 1) + f.ox, sy + f.oy, plain);
      } else inkText(r, '*', sx + s * 8, sy, PAL.gold[1]);
    }
    if (starsT < 5 * STAR_TICKS) return;
    sy += 13;
    for (const line of c.quote) {
      inkText(r, line, sx, sy, INK);
      sy += 9;
    }
  }


  /** 1 player: the character's victory pose in a little photo frame under the critics' quote. */
  private drawPortrait(r: Renderer, c: Column, x: number, y: number): void {
    const art = getCharacter(c.slot.character).art;
    const id = hasSprite(`${art}/victory`) ? `${art}/victory` : hasSprite(`${art}/portrait`) ? `${art}/portrait` : null;
    if (!id) return;
    // The photo: a grey halftone box with an ink frame.
    r.rect(x - 25, y, 50, 56, INK, plain);
    r.rect(x - 24, y + 1, 48, 54, PAL.stone[3], plain);
    r.rect(x - 24, y + 44, 48, 11, PAL.stone[2], plain);
    if (id.endsWith('/victory')) r.sprite(id, Math.floor(this.t / 8), x, y + 51, plain);
    else {
      const f = getFrame(id, 0);
      r.sprite(id, 0, x - 16 + f.ox, y + 12 + f.oy, plain);
    }
  }
}

/** Ink on paper: no outline. */
function inkText(r: Renderer, s: string, x: number, y: number, color: Color, align: 'left' | 'center' | 'right' = 'left', font: 'small' | 'big' = 'small'): void {
  uiText(r, s, x, y, color, align, font, null);
}
