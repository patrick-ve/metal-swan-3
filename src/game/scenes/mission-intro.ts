/**
 * Mission intro card (GDD §2.4, §13.6; at most 360 ticks, start skips after 60): a black screen
 * with a 1-colour line map of the region and a blinking dot; `MISSION 1` (big, C, y 24; m5
 * `FINAL MISSION`), the mission name (big, gold, C, y 40) and the place and time (small, C,
 * y 54). The radio box (x 16–368, y 120–200, `ui` ramp) shows Brigadier Gusto's portrait (32 × 32
 * at (24, 128)) and his 2 briefing lines typed at 2 characters per tick over `env/radio-static`,
 * word-wrapped to x 64–360 (max 4 lines); each line is voiced by its sample (`say`) when its typing
 * starts, the next one once he has finished the one before. Music `briefing`. `PRESS START TO SKIP` (small, C,
 * y 206). Then a fade to the mission, which opens with its `MISSION 1` / `START!` banner.
 */
import type { Color } from '../../engine/color';
import { measure } from '../../engine/font';
import { INK, PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { getFrame, hasSprite } from '../../engine/sprites';
import { blinkOn, centerText, drawPanel, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { BRIEFING_SPEAKER, missionCard, type MissionCard } from './flow-data';
import { getMission } from '../registry';
import { GameplayScene, preloadMissionArt, preloadMissionAudio } from './gameplay';

/** GDD §13.6: the card lasts at most 360 ticks; start skips it after 60. */
export const INTRO_TICKS = 360;
export const INTRO_SKIP_AFTER = 60;
/** Typing speed (characters per tick) and the text area of the radio box. */
const TYPE_RATE = 2;
const TEXT_X = 64;
const TEXT_RIGHT = 360;
const TEXT_Y = 136;
/** Typing starts after the radio crackles for a moment. */
const TYPE_START = 24;

/** The most lines the radio box shows. */
const MAX_LINES = 4;

/** Word-wrap one briefing line to a pixel width. */
function wrap(para: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of para.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, 'small') <= width) line = next;
    else {
      if (line) out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Word-wrap the briefing to the radio box (pixel width, max 4 lines). */
export function briefingLines(card: MissionCard, width = TEXT_RIGHT - TEXT_X): string[] {
  return card.briefing.flatMap((para) => wrap(para, width)).slice(0, MAX_LINES);
}

/**
 * The typed-character count at which each briefing line starts (a line that the 4-line limit
 * cuts off entirely is left out).
 */
export function briefingStarts(card: MissionCard, width = TEXT_RIGHT - TEXT_X): number[] {
  const out: number[] = [];
  let typed = 0;
  let lines = 0;
  for (const para of card.briefing) {
    if (lines >= MAX_LINES) break;
    out.push(typed);
    const shown = wrap(para, width).slice(0, MAX_LINES - lines);
    lines += shown.length;
    for (const l of shown) typed += l.length;
  }
  return out;
}

const plain: DrawOpts = { screen: true };
const mapOpts: DrawOpts = { screen: true, alpha: 0.75 };

export class MissionIntroScene implements Scene {
  private readonly app: GameApp;
  readonly mission: string;
  readonly card: MissionCard;
  private readonly lines: string[];
  private readonly chars: number;
  /** Where each briefing line starts (typed characters) and how many Gusto has said. */
  private readonly starts: number[];
  private spoken = 0;
  private t = 0;
  private leaving = false;
  /** The radio static loop is playing. */
  private radio = false;

  constructor(app: GameApp, mission: string) {
    this.app = app;
    this.mission = mission;
    this.card = missionCard(mission);
    this.lines = briefingLines(this.card);
    this.chars = this.lines.reduce((n, l) => n + l.length, 0);
    this.starts = briefingStarts(this.card);
  }

  /** Characters typed so far. */
  get typed(): number {
    return Math.max(0, Math.min(this.chars, (this.t - TYPE_START) * TYPE_RATE));
  }

  enter(): void {
    this.app.input.suppress();
    this.app.pointerPressed = false;
    this.app.audio.duckMusic?.(1);
    this.app.audio.music('briefing', { fadeTicks: 20 });
    // A 2× mission (ams): generate its 2× sprites while the card is shown.
    preloadMissionArt(this.app, getMission(this.mission));
    // Its sampled music, sounds and dialogue load while the card is shown.
    preloadMissionAudio(this.app, getMission(this.mission));
  }

  exit(): void {
    if (this.radio) this.app.audio.stopSfx?.('radio');
    this.radio = false;
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    // Radio static under the typing (started and stopped once, not every tick).
    const static_ = this.t > TYPE_START - 8 && this.typed < this.chars;
    if (static_ !== this.radio) {
      this.radio = static_;
      if (static_) app.audio.sfxLoop?.('radio', 'env/radio-static', { vol: 0.5 });
      else app.audio.stopSfx?.('radio');
    }
    // Gusto voices each briefing line as its typing starts (when its sample is loaded); a later
    // line waits until he has finished the one before, so he never cuts himself off.
    const next = this.spoken;
    if (next < this.starts.length && this.t > TYPE_START && this.typed >= this.starts[next] && !(next > 0 && app.audio.speaking?.())) {
      this.spoken++;
      app.audio.say?.(this.card.briefing[next], BRIEFING_SPEAKER, { important: true });
    }
    const pad = app.input.pad(0);
    const pad2 = app.input.pad(1);
    const skip = pad.pressed('start') || pad.pressed('fire') || pad2.pressed('start') || app.input.keyPressed('Enter');
    if (this.t >= INTRO_TICKS || (skip && this.t >= INTRO_SKIP_AFTER)) this.go();
  }

  private go(): void {
    this.leaving = true;
    if (this.radio) this.app.audio.stopSfx?.('radio');
    this.radio = false;
    this.app.scenes.replace(new GameplayScene(this.app, { mission: this.mission }), { fade: 40 });
  }

  draw(r: Renderer): void {
    r.begin(0x000000ff);
    this.drawMap(r);
    const card = this.card;
    centerText(r, card.label, 24, UI_WHITE, 'big');
    centerText(r, card.name, 40, UI_GOLD, 'big');
    if (card.place) centerText(r, card.place, 54, PAL.snow[1]);
    this.drawRadio(r);
    if (this.t >= INTRO_SKIP_AFTER && blinkOn(this.t)) centerText(r, 'PRESS START TO SKIP', 206, PAL.stone[3]);
  }

  /** The line map (one colour) and the blinking dot of the mission's location. */
  private drawMap(r: Renderer): void {
    const map = this.card.map;
    if (!map) return;
    const col: Color = PAL.teal[1];
    // The map draws itself in over the first 40 ticks.
    const k = Math.min(1, this.t / 40);
    for (const line of map.lines) {
      const segs = Math.floor(((line.length >> 1) - 1) * k + 0.999);
      for (let i = 0; i < segs; i++) r.line(line[i * 2], line[i * 2 + 1], line[i * 2 + 2], line[i * 2 + 3], col, mapOpts);
    }
    if (k >= 1) for (const [text, x, y] of map.labels ?? []) uiText(r, text, x, y, PAL.teal[0], 'center', 'small', null);
    if (this.t > 30 && blinkOn(this.t, 15)) {
      const [x, y] = map.dot;
      r.rect(x - 2, y - 1, 5, 3, PAL.red[3], plain);
      r.rect(x - 1, y - 2, 3, 5, PAL.red[3], plain);
      r.rect(x, y, 1, 1, PAL.snow[3], plain);
    }
  }

  private drawRadio(r: Renderer): void {
    drawPanel(r, 16, 120, 352, 80, 0.95);
    // Gusto's portrait (24, 128) with a little radio tag under it.
    if (hasSprite('ui/portrait-gusto')) {
      const f = getFrame('ui/portrait-gusto', 0);
      r.sprite('ui/portrait-gusto', 0, 24 + f.ox, 128 + f.oy, plain);
    } else r.rect(24, 128, 32, 32, PAL.navy[1], plain);
    uiText(r, 'GUSTO', 40, 164, PAL.gold[2], 'center');
    // A live signal: a crackling bar under the name while he talks.
    const talking = this.typed < this.chars && this.t > TYPE_START;
    for (let i = 0; i < 5; i++) {
      const h = talking ? 1 + ((this.t * 7 + i * 13) % 5) : 1;
      r.rect(28 + i * 5, 182 - h, 3, h, talking ? PAL.teal[3] : PAL.teal[0], plain);
    }
    uiText(r, 'BRIGADIER LIONEL GUSTO:', TEXT_X, 124, PAL.gold[2], 'left', 'small', INK);
    let left = this.typed;
    for (let i = 0; i < this.lines.length; i++) {
      if (left <= 0) break;
      const line = this.lines[i];
      const shown = line.slice(0, left);
      left -= line.length;
      uiText(r, shown, TEXT_X, TEXT_Y + i * 12, UI_WHITE);
      // The typing cursor.
      if (left < 0 && blinkOn(this.t, 6)) r.rect(TEXT_X + measure(shown, 'small') + 1, TEXT_Y + i * 12, 4, 7, PAL.snow[1], plain);
    }
  }
}
