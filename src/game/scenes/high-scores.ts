/**
 * High scores (GDD §13.14): `HALL OF FAME` in stencil (C, y 12; docs/design/squad.md §3.5) over
 * the night base (base.ts); ten rows from y 40, 14 px apart
 * (small): rank (`1ST` … `10TH`) at x 32, initials at x 80, the 7-digit score right-aligned at
 * x 220, the character's head at x 228, the mission reached (`M3` or `ALL`) at x 252, the
 * difficulty (E, N, H) at x 284 and the continues used (`C2`, blank if none) at x 304.
 *
 * Modes: 'attract' (300 ticks in the title's attract loop, then the title), 'after-game' (new
 * rows blink; a press or 600 ticks → the title) and 'menu' (from the mode select; back returns).
 *
 * Two tables (docs/design/oat.md §7.7): `budgets` (the euro runs: the route) shows the signed
 * budget (`€ 2.500,00`) right-aligned at x 220; `points` (the dormant ring, m0–m5 by URL) the
 * 7-digit score as before. The attract loop and the menu show the budgets; after a game the
 * table of the game just played.
 */
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import { getFrame, hasSprite } from '../../engine/sprites';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, euroText, menuKeys, scoreText, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import type { HighScoreEntry } from '../session';
import { missionNumber, rankLabel } from './flow-data';
import { toTitle } from './flow';
import { headIcon, headSpriteId } from './heads';
import { drawBase, drawStencilTitle, screenArtOf } from './base';
import { veil } from './lake';

export type HighScoresMode = 'attract' | 'after-game' | 'menu';

/** Which table (docs/design/oat.md §7.7): the euro runs' `budgets` or the point runs' `points`. */
export type HighScoresTable = 'budgets' | 'points';

export interface HighScoresOpts {
  mode: HighScoresMode;
  /** Ranks (0-based) of the rows just entered: they blink. */
  highlight?: readonly number[];
  /** The title clock to keep the lake moving (attract). */
  clock?: number;
  /** The table; default: after a game the one of that game (`session.euroRun`), else `budgets`. */
  table?: HighScoresTable;
}

/** The table a screen shows when its opts name none. */
export function tableOf(app: GameApp, opts: HighScoresOpts): HighScoresTable {
  if (opts.table) return opts.table;
  return opts.mode === 'after-game' && app.session && !app.session.euroRun ? 'points' : 'budgets';
}

/** One row of either table, as the screen draws it. */
interface ShownRow {
  name: string;
  value: string;
  mission: string;
  character: string;
  continues: number;
  difficulty?: 'easy' | 'normal' | 'hard';
}

/** GDD §13.3: the high scores show for 300 ticks in the attract loop. */
export const ATTRACT_SCORES_TICKS = 300;
const AFTER_GAME_TICKS = 600;

/**
 * The mission column: 'ALL' for a finished game, else the mission number (`missionNumber`): on
 * the route 'ams' → 'M1', 'oat' → 'M2', 'rally' → 'M3', 'oldenzaal' → 'M5' (the fps floors count
 * as level 4; docs/design/oat.md §1; the dormant 'ring' is off the route: 'RIN'); the passive campaign missions
 * by their old place ('m1' → 'M2' … 'm5' → 'M6'); the fps floors 'fps-N' → 'FN'; other `mN` ids →
 * 'MN'.
 */
export function missionColumn(e: HighScoreEntry): string {
  return missionText(e.mission);
}

/** The mission column of a mission id (both tables: the points' and the budgets'). */
function missionText(mission: string): string {
  if (mission === 'all') return 'ALL';
  // The first-person floors (docs/design/fps.md §1.9): fps-1 → F1, fps-2 → F2.
  const f = /^fps-(\d+)$/.exec(mission);
  if (f) return `F${f[1]}`;
  const n = missionNumber(mission);
  if (n > 0) return `M${n}`;
  const m = /^m(\d+)$/.exec(mission);
  return m ? `M${m[1]}` : mission.toUpperCase().slice(0, 3);
}

export class HighScoresScene implements Scene {
  private readonly app: GameApp;
  private readonly opts: HighScoresOpts;
  private t = 0;
  private leaving = false;
  /** The table shown (fixed at the start: the session may end while it shows). */
  readonly table: HighScoresTable;
  /** Its rows as drawn (made once). */
  private readonly shown: ShownRow[];

  constructor(app: GameApp, opts: HighScoresOpts) {
    this.app = app;
    this.opts = opts;
    this.table = tableOf(app, opts);
    this.shown = this.rows();
  }

  /** The rows of the table shown. */
  private rows(): ShownRow[] {
    if (this.table === 'budgets') return this.app.budgets.entries.map((e) => ({ ...e, value: euroText(e.cents) }));
    return this.app.highScores.entries.map((e) => ({ ...e, value: scoreText(e.score) }));
  }

  enter(): void {
    this.app.input.suppress();
    this.app.pointerPressed = false;
    if (this.opts.mode === 'after-game') this.app.audio.music('high-score', { fadeTicks: 20 });
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    const k = menuKeys(app.input);
    const press = app.input.anyPressed() || app.pointerPressed;
    app.pointerPressed = false;
    switch (this.opts.mode) {
      case 'menu':
        if (k.back || k.confirm) {
          this.leaving = true;
          app.audio.sfx('ui/cancel');
          app.scenes.pop({ fade: 16 });
        }
        break;
      case 'attract':
        if (press || this.t >= ATTRACT_SCORES_TICKS) {
          this.leaving = true;
          toTitle(app, 30);
        }
        break;
      case 'after-game':
        if ((press && this.t > 40) || this.t >= AFTER_GAME_TICKS) {
          this.leaving = true;
          toTitle(app, 40);
        }
        break;
    }
  }

  draw(r: Renderer): void {
    drawBase(r, (this.opts.clock ?? 0) + this.t);
    veil(r, 0.72);
    drawStencilTitle(r, 'HALL OF FAME', 12);
    const list = this.shown;
    const hl = this.opts.highlight ?? [];
    for (let i = 0; i < 10; i++) {
      const e = list[i];
      const y = 40 + i * 14;
      const fresh = hl.includes(i);
      const col = fresh ? (blinkOn(this.t, 15) ? UI_GOLD : UI_WHITE) : i === 0 ? UI_GOLD : PAL.snow[2];
      uiText(r, rankLabel(i), 32, y, i < 3 ? UI_GOLD : PAL.stone[3]);
      if (!e) {
        uiText(r, '---', 80, y, PAL.stone[1]);
        continue;
      }
      uiText(r, e.name, 80, y, col);
      uiText(r, e.value, 220, y, col, 'right');
      drawHead(r, e.character, 228, y + 3);
      uiText(r, missionText(e.mission), 252, y, PAL.snow[1]);
      const d = e.difficulty === 'easy' ? 'E' : e.difficulty === 'hard' ? 'H' : 'N';
      uiText(r, d, 284, y, e.difficulty === 'hard' ? PAL.red[3] : e.difficulty === 'easy' ? PAL.green[3] : PAL.snow[1]);
      if (e.continues > 0) uiText(r, `C${Math.min(99, e.continues)}`, 304, y, PAL.stone[3]);
    }
    if (this.opts.mode === 'menu' && blinkOn(this.t)) centerText(r, 'PRESS FIRE TO GO BACK', 196, PAL.stone[3]);
  }
}

const headOpts: DrawOpts = { screen: true };

/**
 * The head icon of `id` with its left edge at x and its middle row at `midY` (top = midY − ⌊h / 2⌋):
 * the painted HD icon (`ui/score-head/<id>`) at the screen density once it is built, else the 1×
 * icon; nothing when the character has none.
 */
function drawHead(r: Renderer, id: string, x: number, midY: number): void {
  const one = headIcon(id);
  if (!one) return;
  const top = midY - (one.h >> 1);
  const sid = headSpriteId(id);
  const d = hasSprite(sid) ? screenArtOf(r, sid) : 1;
  if (d > 1) r.frame(getFrame(sid, 0, d), x, top, headOpts);
  else r.image(one, x, top, headOpts);
}
