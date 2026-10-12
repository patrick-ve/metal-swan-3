/**
 * Name entry (GDD §13.14): `ENTER YOUR INITIALS` (big, C, y 40); three letter slots (big) at
 * x 168, 184, 200, y 80; up / down cycles A–Z, 0–9, `.` and `END`; fire (or jump / start)
 * confirms a slot, bomb steps back; a 30-second timer (small, right-aligned at (380, 4)); music
 * `high-score`; the announcer says "NEW HIGH SCORE! ENCORE!" when the screen opens. Co-op: one
 * entry per qualifying player, one after the other, each on their own controls.
 */
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, PLAYER_COLORS, repeatPressed, scoreText, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { getCharacter } from '../registry';
import type { PlayerSlot } from '../session';
import { rankLabel, VOICE } from './flow-data';
import { entryFor } from './flow';
import { HighScoresScene } from './high-scores';
import { drawLake, veil } from './lake';

/** The characters a slot cycles through; 'END' finishes the entry early. */
export const NAME_CHARS: readonly string[] = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.', 'END'];
const END = NAME_CHARS.length - 1;
const SLOT_X: readonly number[] = [168, 184, 200];
/** 30 seconds to enter a name (GDD §13.14). */
export const NAME_TICKS = 30 * 60;

export class NameEntryScene implements Scene {
  private readonly app: GameApp;
  private readonly queue: PlayerSlot[];
  private readonly finished: boolean;
  /** The slot entering now (index into the queue), its letters and the active position. */
  private current = 0;
  private letters: number[] = [0, 0, 0];
  private pos = 0;
  private left = NAME_TICKS;
  private t = 0;
  private readonly ranks: number[] = [];
  private done = false;

  constructor(app: GameApp, queue: readonly PlayerSlot[], finished: boolean) {
    this.app = app;
    this.queue = [...queue];
    this.finished = finished;
  }

  /** The player entering now. */
  get slot(): PlayerSlot | null {
    return this.queue[this.current] ?? null;
  }

  enter(): void {
    this.app.input.suppress();
    this.app.audio.music('high-score', { fadeTicks: 20 });
    this.app.audio.voice(VOICE.highScore);
  }

  /** In co-op the second score may have dropped out of the table after the first entry. */
  private skipUnqualified(): void {
    while (this.slot && !this.app.highScores.qualifies(this.slot.score)) this.current++;
  }

  update(): void {
    this.t++;
    if (this.done) return;
    // (Scene changes never happen in enter(): the check runs on the first tick.)
    this.skipUnqualified();
    const slot = this.slot;
    if (!slot) {
      this.finish();
      return;
    }
    const input = this.app.input;
    // 1 player: the solo controls (pad 0); 2 players: each player's own pad.
    const pi = (input.players === 2 ? slot.index : 0) as 0 | 1;
    const pad = input.pad(pi);
    const n = NAME_CHARS.length;
    if (repeatPressed(input, pi, 'up') || repeatPressed(input, pi, 'right')) this.step(1, n);
    if (repeatPressed(input, pi, 'down') || repeatPressed(input, pi, 'left')) this.step(-1, n);
    if (pad.pressed('bomb') && this.pos > 0) {
      this.pos--;
      this.app.audio.sfx('ui/cancel');
    }
    const confirm = pad.pressed('fire') || pad.pressed('jump') || pad.pressed('start');
    if (--this.left <= 0) {
      this.submit();
      return;
    }
    if (!confirm) return;
    this.app.audio.sfx('ui/confirm');
    if (this.letters[this.pos] === END || this.pos >= this.letters.length - 1) this.submit();
    else {
      this.pos++;
      this.letters[this.pos] = this.letters[this.pos - 1] === END ? 0 : this.letters[this.pos - 1];
    }
  }

  private step(d: number, n: number): void {
    this.letters[this.pos] = (this.letters[this.pos] + d + n) % n;
    this.app.audio.sfx('ui/name-letter');
  }

  /** Save this player's row and go on with the next one. */
  private submit(): void {
    const slot = this.slot;
    if (!slot) return;
    let name = '';
    for (let i = 0; i <= Math.min(this.pos, 2); i++) {
      const c = this.letters[i];
      if (c === END) break;
      name += NAME_CHARS[c];
    }
    name = name.trim() || '???';
    const rank = this.app.highScores.submit(entryFor(this.app, slot, this.finished, name));
    if (rank >= 0) this.ranks.push(rank);
    this.current++;
    this.letters = [0, 0, 0];
    this.pos = 0;
    this.left = NAME_TICKS;
    this.app.input.suppress();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.app.highScores.save(this.app.store);
    this.app.scenes.replace(new HighScoresScene(this.app, { mode: 'after-game', highlight: this.ranks }), { fade: 30 });
  }

  draw(r: Renderer): void {
    drawLake(r, this.t);
    veil(r, 0.72);
    const slot = this.slot;
    centerText(r, 'ENTER YOUR INITIALS', 40, UI_GOLD, 'big');
    uiText(r, String(Math.ceil(Math.max(0, this.left) / 60)).padStart(2, '0'), 380, 4, this.left < 600 ? PAL.red[3] : UI_WHITE, 'right');
    if (!slot) return;
    const col = PLAYER_COLORS[slot.index];
    for (let i = 0; i < 3; i++) {
      const active = i === this.pos;
      const shown = i < this.pos || active;
      const c = this.letters[i];
      const ch = shown ? (c === END ? '' : NAME_CHARS[c]) : '.';
      const x = SLOT_X[i];
      if (shown && c === END && active) uiText(r, 'END', x - 4, 82, UI_GOLD, 'left');
      else uiText(r, ch, x, 80, active ? UI_GOLD : shown ? UI_WHITE : PAL.stone[1], 'left', 'big');
      // The active slot: a blinking underline and the up / down hint.
      r.rect(x, 90, 8, 1, active && blinkOn(this.t, 15) ? UI_GOLD : PAL.stone[1], { screen: true });
      if (active) {
        uiText(r, '↑', x + 1, 70, PAL.stone[3]);
        uiText(r, '↓', x + 1, 94, PAL.stone[3]);
      }
    }
    const ch = getCharacter(slot.character);
    const tag = slot.index === 0 ? '1P' : '2P';
    centerText(r, `${tag}  ${ch.name}  ${scoreText(slot.score)}`, 116, col);
    const rank = this.app.highScores.entries.findIndex((e) => slot.score > e.score);
    centerText(r, `YOUR RANK: ${rankLabel(rank < 0 ? this.app.highScores.entries.length : rank)}`, 128, UI_WHITE);
    centerText(r, 'UP / DOWN: LETTER   FIRE: OK   BOMB: BACK', 196, PAL.stone[3]);
  }
}
