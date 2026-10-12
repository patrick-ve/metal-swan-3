/**
 * Character select (GDD §13.5): `CHOOSE YOUR CYGNET` (big, C, y 12) and a 20-second timer (big,
 * right-aligned at (376, 12); at 0 the highlighted character is chosen). The heroes from the
 * registry in roster order: 32 × 32 portraits centred at x 72, 152, 232, 312 (y 40–72) with
 * their short names (small, y 76). Cursors: P1 a sky frame with a `1P` tag, P2 a gold frame with
 * a `2P` tag; a character the other player took turns grey. Below: the highlighted character's
 * full figure in its idle animation (feet at (88, 196)) and a text box (x 140–376, y 100–196)
 * with the full name and rank, the role and the quote. On confirm: the victory pose (30 ticks),
 * the announcer calls the name, `ui/select-confirm`. Then the first mission's intro card.
 */
import type { Color } from '../../engine/color';
import { INK, PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { getFrame, hasSprite } from '../../engine/sprites';
import { blinkOn, centerText, drawPanel, menuKeys, PLAYER_COLORS, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { wrapText } from '../context';
import { getCharacter, hasCharacter, listCharacters, type CharacterDef } from '../registry';
import { CHARACTER_TEXTS, ROSTER } from './flow-data';
import { startCampaign } from './flow';
import { drawLake, veil } from './lake';
import { ModeSelectScene } from './mode-select';
import { titleClock } from './title';

/** GDD §13.5: 20 seconds to choose; the victory pose shows 30 ticks after a confirm. */
export const SELECT_SECONDS = 20;
export const CONFIRM_TICKS = 30;
const PORTRAIT_X: readonly number[] = [72, 152, 232, 312];
const PORTRAIT_Y = 40;
/** Text box (GDD §13.5): x 140–376, y 100–196. */
const BOX = { x: 140, y: 100, w: 236, h: 96 } as const;
const LINE_CHARS = 38;

/** The select-screen texts of a character (registry fields first, then the GDD defaults). */
export function selectTexts(def: CharacterDef): { fullName: string; role: string; quote: string; quoteSub: string } {
  const fb = CHARACTER_TEXTS[def.id];
  return {
    fullName: def.fullName ?? fb?.fullName ?? def.title ?? def.name,
    role: def.role ?? fb?.role ?? def.description ?? '',
    quote: def.quote ?? fb?.quote ?? '',
    quoteSub: def.quoteSub ?? fb?.quoteSub ?? '',
  };
}

/** The playable roster in GDD order; the test character `recruit` only when nobody else exists. */
export function selectRoster(): string[] {
  const ids = ROSTER.filter((id) => hasCharacter(id));
  if (ids.length) return ids;
  const all = listCharacters();
  return all.length ? all.slice(0, 4) : ['recruit'];
}

interface Cursor {
  index: number;
  /** Chosen character (null while choosing) and the ticks since the choice. */
  chosen: string | null;
  chosenT: number;
}

const sprite: DrawOpts = { screen: true };
const greyOpts: DrawOpts = { screen: true, tint: PAL.stone[1], alpha: 0.7 };

export class CharacterSelectScene implements Scene {
  private readonly app: GameApp;
  readonly players: 1 | 2;
  readonly roster: string[];
  private readonly cursors: Cursor[];
  private left = SELECT_SECONDS * 60;
  private t = 0;
  /** The cursor that moved last (its character fills the text box). */
  private focus = 0;
  private leaving = false;

  constructor(app: GameApp, players: 1 | 2 = 1) {
    this.app = app;
    this.players = players;
    this.roster = selectRoster();
    this.cursors = [];
    for (let i = 0; i < players; i++) this.cursors.push({ index: Math.min(i, this.roster.length - 1), chosen: null, chosenT: 0 });
  }

  /** The characters chosen so far (one per player, null while choosing). */
  get choices(): (string | null)[] {
    return this.cursors.map((c) => c.chosen);
  }

  enter(): void {
    this.app.input.players = this.players;
    this.app.input.suppress();
    this.app.audio.music('select', { fadeTicks: 30 });
  }

  private takenByOther(p: number, id: string): boolean {
    return this.cursors.some((c, i) => i !== p && c.chosen === id);
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    for (let p = 0; p < this.cursors.length; p++) {
      const c = this.cursors[p];
      if (c.chosen) {
        c.chosenT++;
        continue;
      }
      const k = menuKeys(app.input, p as 0 | 1);
      const n = this.roster.length;
      if (k.left || k.right) {
        c.index = (c.index + (k.left ? -1 : 1) + n) % n;
        this.focus = p;
        app.audio.sfx('ui/move');
      }
      if (k.confirm) this.choose(p);
      else if (k.back && this.cursors.every((q) => !q.chosen)) {
        this.leaving = true;
        app.audio.sfx('ui/cancel');
        app.scenes.replace(new ModeSelectScene(app, this.players === 2 ? 1 : 0), { fade: 16 });
        return;
      }
    }
    // The timer: at 0 everyone still choosing gets the highlighted (or the next free) character.
    if (this.cursors.some((c) => !c.chosen)) {
      if (--this.left <= 0) {
        this.left = 0;
        for (let p = 0; p < this.cursors.length; p++) if (!this.cursors[p].chosen) this.choose(p, true);
      }
    }
    if (this.cursors.every((c) => c.chosen && c.chosenT >= CONFIRM_TICKS)) {
      this.leaving = true;
      startCampaign(app, { players: this.players, characters: this.cursors.map((c) => c.chosen ?? 'recruit') });
    }
  }

  /** Confirm the highlighted character (taken by the other player: refused, or the next free one when `force`). */
  private choose(p: number, force = false): void {
    const c = this.cursors[p];
    const n = this.roster.length;
    let id = this.roster[c.index];
    if (this.takenByOther(p, id)) {
      if (!force) {
        this.app.audio.sfx('ui/cancel');
        return;
      }
      for (let k = 1; k < n; k++) {
        const j = (c.index + k) % n;
        if (!this.takenByOther(p, this.roster[j])) {
          c.index = j;
          break;
        }
      }
      id = this.roster[c.index];
      // A roster of one: both players share it rather than wait forever.
    }
    c.chosen = id;
    c.chosenT = 0;
    this.focus = p;
    const def = getCharacter(id);
    this.app.audio.sfx('ui/select-confirm');
    this.app.audio.voice(def.voice && /!$/.test(def.voice) ? def.voice : `${def.name}!`);
  }

  draw(r: Renderer): void {
    drawLake(r, titleClock() + this.t);
    veil(r, 0.75);
    centerText(r, 'CHOOSE YOUR CYGNET', 12, UI_GOLD, 'big');
    const secs = Math.ceil(this.left / 60);
    uiText(r, String(secs).padStart(2, '0'), 376, 12, secs <= 5 ? PAL.red[3] : UI_WHITE, 'right', 'big');
    const n = this.roster.length;
    const xs = n === 4 ? PORTRAIT_X : this.roster.map((_, i) => Math.round((r.w * (i + 1)) / (n + 1)));
    for (let i = 0; i < n; i++) this.drawPortrait(r, this.roster[i], xs[i]);
    for (let p = 0; p < this.cursors.length; p++) this.drawCursorFrame(r, p, xs[this.cursors[p].index]);
    // The figures (feet at (88, 196); two players side by side) and the text box.
    if (this.cursors.length === 1) this.drawFigure(r, 0, 88);
    else {
      this.drawFigure(r, 0, 60);
      this.drawFigure(r, 1, 112);
    }
    this.drawTextBox(r, this.roster[this.cursors[this.focus]?.index ?? 0]);
  }

  private drawPortrait(r: Renderer, id: string, cx: number): void {
    const def = getCharacter(id);
    const pid = `${def.art}/portrait`;
    const x = cx - 16;
    // Taken by one player while the other still chooses: grey for the other one.
    const taken = this.cursors.some((c) => c.chosen === id);
    const grey = taken && this.cursors.length > 1 && this.cursors.some((c) => !c.chosen);
    r.rect(x - 1, PORTRAIT_Y - 1, 34, 34, INK, sprite);
    if (hasSprite(pid)) {
      const f = getFrame(pid, 0);
      r.sprite(pid, 0, x + f.ox, PORTRAIT_Y + f.oy, sprite);
      if (grey) r.sprite(pid, 0, x + f.ox, PORTRAIT_Y + f.oy, greyOpts);
    } else r.rect(x, PORTRAIT_Y, 32, 32, grey ? PAL.stone[1] : PAL.navy[1], sprite);
    uiText(r, def.name, cx, 76, grey ? PAL.stone[2] : UI_WHITE, 'center');
  }

  private drawCursorFrame(r: Renderer, p: number, cx: number): void {
    const c = this.cursors[p];
    const col: Color = PLAYER_COLORS[p];
    const on = c.chosen ? true : blinkOn(this.t, 20);
    const x = cx - 18 - p;
    const y = PORTRAIT_Y - 3 - p;
    const s = 36 + p * 2;
    if (on) {
      r.rect(x, y, s, 2, col, sprite);
      r.rect(x, y + s - 2, s, 2, col, sprite);
      r.rect(x, y, 2, s, col, sprite);
      r.rect(x + s - 2, y, 2, s, col, sprite);
    }
    // The tag sits on the frame's top edge (P1 left, P2 right).
    const tx = p === 0 ? x + 2 : x + s - 13;
    r.rect(tx - 1, y - 6, 13, 8, INK, sprite);
    uiText(r, p === 0 ? '1P' : '2P', tx + 1, y - 5, col, 'left', 'small', null);
  }

  /** The highlighted character standing in its idle loop (or its victory pose once chosen). */
  private drawFigure(r: Renderer, p: number, x: number): void {
    const c = this.cursors[p];
    if (!c) return;
    const def = getCharacter(this.roster[c.index]);
    const art = def.art;
    const y = 196;
    const legs = `${art}/legs-idle`;
    const torso = `${art}/torso-pistol-idle`;
    if (c.chosen && hasSprite(`${art}/victory`)) r.sprite(`${art}/victory`, Math.floor(c.chosenT / 8), x, y, sprite);
    else if (hasSprite(legs) && hasSprite(torso)) {
      const lf = getFrame(legs, 0);
      const hip = lf.pts?.hip ?? [0, -14];
      r.sprite(legs, 0, x, y, sprite);
      r.sprite(torso, Math.floor(this.t / 20), x + hip[0], y + hip[1], sprite);
    }
    if (this.cursors.length > 1) uiText(r, p === 0 ? '1P' : '2P', x, y + 2, PLAYER_COLORS[p], 'center');
  }

  private drawTextBox(r: Renderer, id: string): void {
    drawPanel(r, BOX.x, BOX.y, BOX.w, BOX.h, 0.85);
    const def = getCharacter(id);
    const tx = selectTexts(def);
    let y = BOX.y + 6;
    const x = BOX.x + 6;
    const lines = (s: string, col: Color, max = 3): void => {
      for (const line of wrapText(s, LINE_CHARS, max)) {
        if (y > BOX.y + BOX.h - 10) return;
        uiText(r, line, x, y, col);
        y += 10;
      }
    };
    lines(tx.fullName, UI_GOLD, 2);
    lines(tx.role, PAL.sky[3], 2);
    y += 4;
    lines(tx.quote, UI_WHITE, 4);
    if (tx.quoteSub) lines(tx.quoteSub, PAL.stone[3], 2);
  }
}
