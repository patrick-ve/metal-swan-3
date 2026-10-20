/**
 * Mode select (GDD §13.4; military, docs/design/squad.md §3.3): the night base under a veil and
 * the stencil header `SELECT OPERATION` (C, y 36); music `select` (it keeps playing on REPORT
 * FOR DUTY). A vertical menu, big, C, from y 80, 16 px apart: `1 SOLDIER` · `2 SOLDIERS` ·
 * `DIFFICULTY  < NORMAL >` (with a gold small nickname under it — "RECRUIT", "VETERAN" or
 * "COMMANDO" — and a hint at C, y 170) · `OPTIONS` · `HALL OF FAME`. Back returns to the title.
 * The difficulty ids stay easy / normal / hard.
 */
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { centerText, menuKeys, scoreText, textWidth, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { saveSettings } from '../settings';
import { CharacterSelectScene, MIL_ART } from './character-select';
import { DIFFICULTIES, DIFFICULTY_INFO } from './flow-data';
import { toTitle } from './flow';
import { HighScoresScene } from './high-scores';
import { drawBase, drawScreenCursor, drawStencilTitle, prefetchScreenArt } from './base';
import { veil } from './lake';
import { OptionsScene } from './options';
import { titleClock } from './title';

type Item = '1P' | '2P' | 'DIFFICULTY' | 'OPTIONS' | 'HIGH SCORES';
const ITEMS: readonly Item[] = ['1P', '2P', 'DIFFICULTY', 'OPTIONS', 'HIGH SCORES'];
const TOP = 80;
const STEP = 16;
/** The DIFFICULTY row and the extra space under it for its gold subtitle. */
const DIFF_ROW = 2;
const SUB_GAP = 8;

export class ModeSelectScene implements Scene {
  private readonly app: GameApp;
  private sel = 0;
  private t = 0;
  private leaving = false;
  /** The select screen's furniture was handed to the screen art pool (once). */
  private prefetched = false;

  constructor(app: GameApp, sel = 0) {
    this.app = app;
    this.sel = sel;
  }

  enter(): void {
    this.app.input.players = 1;
    this.app.input.suppress();
    this.app.audio.music('title', { fadeTicks: 30 });
  }

  resume(): void {
    this.app.input.suppress();
    this.app.audio.music('title', { fadeTicks: 30 });
  }

  /** The label of a menu row. */
  label(item: Item): string {
    switch (item) {
      case '1P':
        return '1 SOLDIER';
      case '2P':
        return '2 SOLDIERS';
      case 'HIGH SCORES':
        return 'HALL OF FAME';
      case 'DIFFICULTY':
        return `DIFFICULTY  < ${DIFFICULTY_INFO[this.app.settings.difficulty].name} >`;
      default:
        return item;
    }
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = menuKeys(app.input);
    if (k.up) this.move(-1);
    if (k.down) this.move(1);
    const item = ITEMS[this.sel];
    if (item === 'DIFFICULTY' && (k.left || k.right)) this.cycleDifficulty(k.left ? -1 : 1);
    if (k.back) {
      this.leaving = true;
      app.audio.sfx('ui/cancel');
      toTitle(app, 16);
      return;
    }
    if (!k.confirm) return;
    switch (item) {
      case '1P':
      case '2P':
        this.leaving = true;
        app.audio.sfx('ui/confirm');
        app.scenes.replace(new CharacterSelectScene(app, item === '2P' ? 2 : 1), { fade: 16 });
        break;
      case 'DIFFICULTY':
        this.cycleDifficulty(1);
        break;
      case 'OPTIONS':
        app.audio.sfx('ui/confirm');
        app.scenes.push(new OptionsScene(app), { fade: 16 });
        break;
      case 'HIGH SCORES':
        app.audio.sfx('ui/confirm');
        app.scenes.push(new HighScoresScene(app, { mode: 'menu', clock: titleClock() }), { fade: 16 });
        break;
    }
  }

  private move(d: number): void {
    this.sel = (this.sel + d + ITEMS.length) % ITEMS.length;
    this.app.audio.sfx('ui/move');
  }

  private cycleDifficulty(d: number): void {
    const s = this.app.settings;
    const i = DIFFICULTIES.indexOf(s.difficulty);
    s.difficulty = DIFFICULTIES[(i + d + DIFFICULTIES.length) % DIFFICULTIES.length];
    saveSettings(this.app.store, s);
    this.app.audio.sfx('ui/move');
  }

  draw(r: Renderer): void {
    const clock = titleClock() + this.t;
    drawBase(r, clock);
    veil(r, 0.6);
    centerText(r, `HI ${scoreText(this.app.highScores.top)}`, 4, UI_WHITE);
    drawStencilTitle(r, 'SELECT OPERATION', 36);
    // The select screen comes next: its HD furniture builds while this menu shows.
    if (!this.prefetched) {
      this.prefetched = true;
      prefetchScreenArt(r, MIL_ART);
    }
    for (let i = 0; i < ITEMS.length; i++) {
      const sel = i === this.sel;
      // The rows under DIFFICULTY move down to make room for its subtitle.
      const y = TOP + i * STEP + (i > DIFF_ROW ? SUB_GAP : 0);
      const text = this.label(ITEMS[i]);
      centerText(r, text, y, sel ? UI_GOLD : PAL.snow[1], 'big');
      if (sel) drawScreenCursor(r, (r.w >> 1) - (textWidth(text, 'big') >> 1) - 5, y + 4, this.t);
    }
    const info = DIFFICULTY_INFO[this.app.settings.difficulty];
    // The nickname under the difficulty row, the hint at y 170.
    uiText(r, info.nick, r.w >> 1, TOP + DIFF_ROW * STEP + 10, PAL.gold[3], 'center', 'small');
    centerText(r, info.hint, 170, ITEMS[this.sel] === 'DIFFICULTY' ? UI_WHITE : PAL.stone[3]);
    centerText(r, 'UP / DOWN: CHOOSE   FIRE: OK   BOMB: BACK', 196, PAL.stone[2]);
  }
}
