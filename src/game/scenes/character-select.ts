/**
 * REPORT FOR DUTY, the character select (docs/design/squad.md §3.4; replaces GDD §13.5). A
 * riveted rust-brown steel frame (`ui/mil/frame`) with five tall panels, one per soldier, each
 * behind an olive shutter with the squad emblem (`ui/mil/shutter`, 8 frames).
 *
 * Layout (logical px): the stencil title `REPORT FOR DUTY` centred in the recess at y 4–26; a
 * badge row at y 30–42 (a P1 lamp left and a P2 lamp right above each panel, `ui/mil/badge-*`);
 * the panels (64 × 120 windows) at x = 14 + i·74, y 46–166; nameplates (`ui/mil/plate`) at
 * y 172–186 with the first name; the bottom row at y 196: `STAND BY` / `READY!` for P1 on the
 * left, the countdown in the centre (big, 2 digits, red at 5 or less, `ui/timer-warn` each second
 * from 5), P2's state on the right (2 players only). The highlighted panel shows the callsign
 * (gold) and the bio in a dark box at its bottom, typed in and scrolling a line at a time when it
 * is longer than 3 lines.
 *
 * Sequence: all shutters closed; after SHUTTER_DELAY ticks they rise one after another
 * (SHUTTER_STAGGER apart, `ui/mil-shutter`), showing the grey portraits (`char/<id>/select-grey`);
 * the highlighted one shows in colour (`char/<id>/select`) and its lamp lights (`ui/move` on a
 * change). Confirm: `ui/select-confirm` and the name callout, the portrait flashes white for
 * FLASH_TICKS, the shutter drops (`ui/mil-clank` as it lands) and a glass preview window on it
 * shows the soldier's in-game idle (legs-idle + torso-pistol-idle at 1×) over a hazard strip. A
 * soldier the other player took cannot be picked (`ui/cancel`). When every player has chosen
 * and every shutter is down, the screen holds 40 ticks, then the campaign starts
 * (`startCampaign`). The timer (SELECT_SECONDS) picks the highlighted (or the next free) soldier
 * at 0. Back (bomb) before any pick: the mode select.
 *
 * Portraits draw at art density 2, so the 2× art shows on a large display. A character without
 * select art shows its 32 × 32 portrait on a dark panel (the retired heroes, tests).
 */
import type { Color } from '../../engine/color';
import { measure } from '../../engine/font';
import { INK, PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { frameW, getFrame, hasSprite, setArtDensity } from '../../engine/sprites';
import { centerText, menuKeys, uiText, UI_GOLD, type GameApp } from '../app';
import {
  MIL_HAZARD_Y,
  MIL_PANEL_H,
  MIL_PANEL_W,
  MIL_PANEL_Y,
  MIL_PANELS,
  MIL_PREVIEW_X,
  MIL_PREVIEW_Y,
  MIL_SHUTTER_DX,
  MIL_SHUTTER_DY,
  MIL_SHUTTER_FRAMES,
  milPanelX,
  stencilId,
} from '../content/ui/military.art';
import { getCharacter, hasCharacter, listCharacters, type CharacterDef } from '../registry';
import { CHARACTER_TEXTS, ROSTER } from './flow-data';
import { startCampaign } from './flow';
import { ModeSelectScene } from './mode-select';

/** 20 seconds to choose (GDD §13.5). */
export const SELECT_SECONDS = 20;
/** The shutters stay closed this long after the screen opens, then rise one by one. */
export const SHUTTER_DELAY = 20;
export const SHUTTER_STAGGER = 8;
/** Ticks per shutter frame (rising and dropping). */
export const SHUTTER_TICKS = 2;
/** The white flash of a confirmed portrait. */
export const FLASH_TICKS = 2;
/** A confirmed shutter is down (the preview shows) this many ticks after the confirm. */
export const DROP_DONE = FLASH_TICKS + (MIL_SHUTTER_FRAMES - 1) * SHUTTER_TICKS;
/** After the last confirm: the shutter drops, then the screen holds 40 ticks before the campaign starts. */
export const CONFIRM_TICKS = DROP_DONE + 40;
/**
 * Bio box: the bio lines shown at once. The box slides up BIO_DELAY ticks after a highlight,
 * types the bio in, scrolls it, holds BIO_HOLD ticks, then slides down for BIO_REST ticks so the
 * whole face shows, and starts again.
 */
export const BIO_LINES = 3;
export const BIO_DELAY = 24;
const BIO_SLIDE = 8;
const BIO_HOLD = 150;
const BIO_REST = 90;
/** Ticks per typed character and per scrolled line. */
const TYPE_TICKS = 1;
const SCROLL_TICKS = 75;
/** Text width in the bio box and the line steps (bio lines have room for descenders). */
const BIO_W = MIL_PANEL_W - 4;
const CALL_H = 8;
const BIO_H = 9;

const TITLE = 'REPORT FOR DUTY';
const BADGE_Y = 31;
const PLATE_Y = 172;
const ROW_Y = 196;
/** Lamp colours of this screen: P1 red, P2 blue (squad.md §2.3). */
const SIDE_COLORS: readonly Color[] = [PAL.red[3], PAL.sky[2]];
/** '00' … '99' (no string building per frame). */
const TWO_DIGITS: readonly string[] = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

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

/** The playable roster in panel order (at most five); the test character `recruit` only when nobody else exists. */
export function selectRoster(): string[] {
  const ids = ROSTER.filter((id) => hasCharacter(id)).slice(0, MIL_PANELS);
  if (ids.length) return ids;
  const all = listCharacters();
  return all.length ? all.slice(0, MIL_PANELS) : ['recruit'];
}

/** The bio box text of a character: the callsign (gold) and the bio lines, wrapped to the panel. */
export interface BioText {
  callsign: string[];
  lines: string[];
  /** Per bio line: the x offset after each character (for the typing cover). */
  stops: number[][];
}

const bioCache = new Map<string, BioText>();

/** Word-wrap to `width` px in the small font; a word wider than a line is split with a hyphen. */
export function wrapSmall(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (let word of text.split(' ')) {
    if (!word) continue;
    // Too wide for any line: hyphenate it over as many lines as it needs.
    while (measure(word, 'small') > width) {
      if (line) {
        out.push(line);
        line = '';
      }
      // Keep at least 3 letters for the next line.
      let k = word.length - 3;
      while (k > 1 && measure(`${word.slice(0, k)}-`, 'small') > width) k--;
      out.push(`${word.slice(0, k)}-`);
      word = word.slice(k);
    }
    const next = line ? `${line} ${word}` : word;
    if (measure(next, 'small') <= width || !line) line = next;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * The callsign in capitals (`callsign` unless it is just the name, else the role) and the bio
 * (`description`, in the case its author wrote it; the quote when there is none), wrapped once.
 */
export function bioText(id: string): BioText {
  let b = bioCache.get(id);
  if (b) return b;
  const def = getCharacter(id);
  const t = selectTexts(def);
  const callsign = (def.callsign && def.callsign !== def.name ? def.callsign : t.role || def.title || '').toUpperCase();
  const bio = def.description ?? t.quote;
  const width = BIO_W;
  const lines = bio ? wrapSmall(bio, width) : [];
  const stops = lines.map((l) => {
    const out: number[] = [];
    for (let i = 1; i <= l.length; i++) out.push(measure(l.slice(0, i), 'small'));
    return out;
  });
  b = { callsign: callsign ? wrapSmall(callsign, width).slice(0, 2) : [], lines, stops };
  bioCache.set(id, b);
  return b;
}

/** The sprite ids a panel draws (built once per screen, no string building per frame). */
interface PanelArt {
  select: string;
  grey: string;
  portrait: string;
  legs: string;
  torso: string;
}

function panelArt(id: string): PanelArt {
  const art = getCharacter(id).art;
  return { select: `${art}/select`, grey: `${art}/select-grey`, portrait: `${art}/portrait`, legs: `${art}/legs-idle`, torso: `${art}/torso-pistol-idle` };
}

interface Cursor {
  index: number;
  /** Chosen character (null while choosing) and the ticks since the choice. */
  chosen: string | null;
  chosenT: number;
  /** The tick the cursor last moved (the bio types in from here). */
  since: number;
}

const plain: DrawOpts = { screen: true };
const greyOpts: DrawOpts = { screen: true, tint: PAL.stone[1], alpha: 0.65 };
const flashOpts: DrawOpts = { screen: true, flash: true };
const boxOpts: DrawOpts = { screen: true };

export class CharacterSelectScene implements Scene {
  private readonly app: GameApp;
  readonly players: 1 | 2;
  readonly roster: string[];
  private readonly art: PanelArt[];
  private readonly cursors: Cursor[];
  private left = SELECT_SECONDS * 60;
  private t = 0;
  private leaving = false;

  constructor(app: GameApp, players: 1 | 2 = 1) {
    this.app = app;
    this.players = players;
    this.roster = selectRoster();
    this.art = this.roster.map(panelArt);
    this.cursors = [];
    for (let i = 0; i < players; i++) this.cursors.push({ index: Math.min(i, this.roster.length - 1), chosen: null, chosenT: 0, since: 0 });
  }

  /** The characters chosen so far (one per player, null while choosing). */
  get choices(): (string | null)[] {
    return this.cursors.map((c) => c.chosen);
  }

  /** The panel player p highlights (-1: no such player). */
  cursorIndex(p: number): number {
    return this.cursors[p]?.index ?? -1;
  }

  /** Whole seconds left on the timer. */
  get secondsLeft(): number {
    return Math.ceil(this.left / 60);
  }

  enter(): void {
    this.app.input.players = this.players;
    this.app.input.suppress();
    this.app.audio.music('select', { fadeTicks: 30 });
  }

  private takenByOther(p: number, id: string): boolean {
    return this.cursors.some((c, i) => i !== p && c.chosen === id);
  }

  /** The player who chose the soldier of panel i (-1: nobody). */
  chosenBy(i: number): number {
    const id = this.roster[i];
    if (id === undefined) return -1;
    for (let p = 0; p < this.cursors.length; p++) if (this.cursors[p].chosen === id) return p;
    return -1;
  }

  /** Is panel i in colour: highlighted by a player still choosing, or chosen? */
  highlighted(i: number): boolean {
    if (i >= this.roster.length) return false;
    if (this.chosenBy(i) >= 0) return true;
    return this.cursors.some((c) => !c.chosen && c.index === i);
  }

  /** Is player p's lamp lit above panel i? */
  badgeLit(p: number, i: number): boolean {
    const c = this.cursors[p];
    return !!c && i < this.roster.length && c.index === i;
  }

  /** The shutter frame of panel i: 0 closed … 7 fully raised (panels without a soldier stay closed). */
  shutterFrame(i: number): number {
    if (i >= this.roster.length) return 0;
    const last = MIL_SHUTTER_FRAMES - 1;
    const open = Math.max(0, Math.min(last, Math.floor((this.t - SHUTTER_DELAY - i * SHUTTER_STAGGER) / SHUTTER_TICKS)));
    const p = this.chosenBy(i);
    if (p < 0) return open;
    const ct = this.cursors[p].chosenT;
    if (ct < FLASH_TICKS) return open;
    const drop = Math.min(last, Math.floor((ct - FLASH_TICKS) / SHUTTER_TICKS) + 1);
    return Math.max(0, Math.min(open, last - drop));
  }

  /** Is player p's preview window showing (chosen, and the shutter is down)? */
  previewShown(p: number): boolean {
    const c = this.cursors[p];
    return !!c?.chosen && c.chosenT >= DROP_DONE;
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    // A rattle as each shutter starts to rise.
    for (let i = 0; i < this.roster.length && i < MIL_PANELS; i++) if (this.t === SHUTTER_DELAY + i * SHUTTER_STAGGER) app.audio.sfx('ui/mil-shutter');
    for (let p = 0; p < this.cursors.length; p++) {
      const c = this.cursors[p];
      if (c.chosen) {
        c.chosenT++;
        if (c.chosenT === DROP_DONE) app.audio.sfx('ui/mil-clank');
        continue;
      }
      const k = menuKeys(app.input, p as 0 | 1);
      const n = this.roster.length;
      if (k.left || k.right) {
        c.index = (c.index + (k.left ? -1 : 1) + n) % n;
        c.since = this.t;
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
    // The timer: a warning tick each second from 5; at 0 everyone still choosing gets the
    // highlighted (or the next free) soldier.
    if (this.cursors.some((c) => !c.chosen)) {
      const before = this.secondsLeft;
      this.left = Math.max(0, this.left - 1);
      const now = this.secondsLeft;
      if (now !== before && now <= 5 && now > 0) app.audio.sfx('ui/timer-warn');
      if (this.left <= 0) {
        for (let p = 0; p < this.cursors.length; p++) if (!this.cursors[p].chosen) this.choose(p, true);
      }
    }
    if (this.cursors.every((c) => c.chosen && c.chosenT >= CONFIRM_TICKS)) {
      this.leaving = true;
      startCampaign(app, { players: this.players, characters: this.cursors.map((c) => c.chosen ?? 'recruit') });
    }
  }

  /** Confirm the highlighted soldier (taken by the other player: refused, or the next free one when `force`). */
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
    const def = getCharacter(id);
    this.app.audio.sfx('ui/select-confirm');
    this.app.audio.voice(def.voice && /!$/.test(def.voice) ? def.voice : `${def.name}!`);
  }

  // -------------------------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------------------------

  draw(r: Renderer): void {
    r.rect(0, 0, r.w, r.h, INK, plain);
    const n = Math.min(MIL_PANELS, this.roster.length);
    // Portraits at art density 2 (the 2× art shows on a large display).
    const prev = setArtDensity(2);
    for (let i = 0; i < n; i++) this.drawPortrait(r, i);
    setArtDensity(prev);
    for (let i = 0; i < MIL_PANELS; i++) {
      if (i < n && this.shutterFrame(i) > 0) this.drawBio(r, i);
      this.drawShutter(r, i);
    }
    if (hasSprite('ui/mil/frame')) r.sprite('ui/mil/frame', 0, 0, 0, plain);
    const sid = stencilId(TITLE);
    if (hasSprite(sid)) r.sprite(sid, 0, (r.w - frameW(getFrame(sid, 0))) >> 1, 6, plain);
    else centerText(r, TITLE, 10, UI_GOLD, 'big');
    for (let i = 0; i < MIL_PANELS; i++) {
      this.drawBadges(r, i);
      this.drawPlate(r, i);
    }
    this.drawBottomRow(r);
  }

  private drawPortrait(r: Renderer, i: number): void {
    const art = this.art[i];
    const x = milPanelX(i);
    const y = MIL_PANEL_Y;
    const lit = this.highlighted(i);
    const p = this.chosenBy(i);
    const flash = p >= 0 && this.cursors[p].chosenT < FLASH_TICKS;
    const colour = art.select;
    const grey = art.grey;
    if (hasSprite(colour)) {
      const sid = lit || !hasSprite(grey) ? colour : grey;
      r.sprite(sid, 0, x, y, plain);
      if (!lit && sid === colour) r.sprite(colour, 0, x, y, greyOpts);
      if (flash) r.sprite(colour, 0, x, y, flashOpts);
      return;
    }
    // No select art: the small portrait on a dark panel.
    r.rect(x, y, MIL_PANEL_W, MIL_PANEL_H, PAL.navy[0], plain);
    r.rect(x, y + 70, MIL_PANEL_W, MIL_PANEL_H - 70, PAL.ink[1], plain);
    const pid = art.portrait;
    if (!hasSprite(pid)) return;
    const f = getFrame(pid, 0);
    const px = x + ((MIL_PANEL_W - frameW(f)) >> 1) + f.ox;
    const py = y + 24 + f.oy;
    r.sprite(pid, 0, px, py, plain);
    if (!lit) r.sprite(pid, 0, px, py, greyOpts);
    if (flash) r.sprite(pid, 0, px, py, flashOpts);
  }

  /** The callsign and bio box at the bottom of a panel highlighted by a player still choosing. */
  private drawBio(r: Renderer, i: number): void {
    let c: Cursor | null = null;
    for (let p = 0; p < this.cursors.length; p++) {
      const q = this.cursors[p];
      if (!q.chosen && q.index === i && (!c || q.since > c.since)) c = q;
    }
    if (!c) return;
    const age = this.t - c.since;
    if (age < BIO_DELAY) return;
    const b = bioText(this.roster[i]);
    const x = milPanelX(i);
    const shown = Math.min(BIO_LINES, b.lines.length);
    let typedAll = 0;
    for (let k = 0; k < shown; k++) typedAll += b.lines[k].length;
    const scrolls = Math.max(0, b.lines.length - BIO_LINES);
    // One cycle: slide up, type, scroll, hold (`up` ticks), slide down, rest.
    const up = BIO_SLIDE + typedAll * TYPE_TICKS + scrolls * SCROLL_TICKS + BIO_HOLD;
    const phase = (age - BIO_DELAY) % (up + BIO_SLIDE + BIO_REST);
    if (phase >= up + BIO_SLIDE) return;
    const slide = phase < BIO_SLIDE ? BIO_SLIDE - phase : phase >= up ? phase - up + 1 : 0;
    const h = 4 + b.callsign.length * CALL_H + shown * BIO_H + (shown ? 2 : 0);
    // Slide from the bottom edge of the window (the frame hides the part below it).
    const y = MIL_PANEL_Y + MIL_PANEL_H - h + Math.ceil((slide * h) / BIO_SLIDE);
    r.rect(x, y, MIL_PANEL_W, h, PAL.ink[1], boxOpts);
    r.rect(x, y, MIL_PANEL_W, 1, PAL.gold[0], plain);
    if (slide > 0) return;
    let ly = y + 3;
    for (let k = 0; k < b.callsign.length; k++) {
      uiText(r, b.callsign[k], x + 2, ly, UI_GOLD, 'left', 'small', null);
      ly += CALL_H;
    }
    ly += 2;
    // Type the first lines in; then scroll one line every SCROLL_TICKS when the bio is longer.
    let typed = Math.floor((phase - BIO_SLIDE) / TYPE_TICKS);
    const first = typed > typedAll ? Math.min(scrolls, Math.floor((typed - typedAll) / SCROLL_TICKS)) : 0;
    for (let k = 0; k < shown && typed > 0; k++) {
      const li = first + k;
      const line = b.lines[li];
      uiText(r, line, x + 2, ly, PAL.snow[2], 'left', 'small', null);
      if (first === 0 && typed < line.length) {
        // Cover the part not typed yet; a block cursor blinks at the typing point.
        const cx = x + 2 + b.stops[li][typed - 1] + 1;
        r.rect(cx, ly - 1, x + MIL_PANEL_W - cx, BIO_H, PAL.ink[1], plain);
        if ((this.t >> 3) & 1) r.rect(cx, ly, 4, 7, PAL.snow[2], plain);
      }
      if (first === 0) typed -= line.length;
      ly += BIO_H;
    }
  }

  private drawShutter(r: Renderer, i: number): void {
    if (!hasSprite('ui/mil/shutter')) return;
    const f = this.shutterFrame(i);
    if (f >= MIL_SHUTTER_FRAMES - 1) return;
    const sx = milPanelX(i) + MIL_SHUTTER_DX;
    const sy = MIL_PANEL_Y + MIL_SHUTTER_DY;
    r.sprite('ui/mil/shutter', f, sx, sy, plain);
    const p = this.chosenBy(i);
    if (p >= 0 && this.previewShown(p)) this.drawPreview(r, p, sx, sy);
  }

  /** The glass preview window on a dropped shutter with the soldier's idle in it. */
  private drawPreview(r: Renderer, p: number, sx: number, sy: number): void {
    const px = sx + MIL_PREVIEW_X;
    const py = sy + MIL_PREVIEW_Y;
    if (hasSprite('ui/mil/preview')) r.sprite('ui/mil/preview', 0, px, py, plain);
    if (hasSprite('ui/mil/hazard')) r.sprite('ui/mil/hazard', 0, sx + 2, sy + MIL_HAZARD_Y, plain);
    const c = this.cursors[p];
    const art = this.art[this.roster.indexOf(c.chosen ?? '')];
    if (!art) return;
    const { legs, torso } = art;
    if (!hasSprite(legs) || !hasSprite(torso)) return;
    const fx = px + 22;
    const fy = py + 46;
    const hip = getFrame(legs, 0).pts?.hip;
    r.sprite(legs, 0, fx, fy, plain);
    r.sprite(torso, Math.floor(c.chosenT / 20), fx + (hip?.[0] ?? 0), fy + (hip?.[1] ?? -14), plain);
  }

  private drawBadges(r: Renderer, i: number): void {
    const x = milPanelX(i);
    for (let side = 0; side < 2; side++) {
      const bx = x + 3 + side * 30;
      const c = this.cursors[side];
      // A lamp blinks while its shutter is still closed, and burns steady once the panel is open.
      const on = this.badgeLit(side, i) && (c.chosen !== null || this.shutterFrame(i) > 0 || ((this.t >> 3) & 1) === 1);
      const id = on ? (side === 0 ? 'ui/mil/badge-p1' : 'ui/mil/badge-p2') : 'ui/mil/badge-off';
      if (hasSprite(id)) r.sprite(id, 0, bx, BADGE_Y, plain);
      else if (on) uiText(r, side === 0 ? 'P1' : 'P2', bx + 14, BADGE_Y + 2, SIDE_COLORS[side], 'center');
    }
  }

  private drawPlate(r: Renderer, i: number): void {
    const x = milPanelX(i);
    if (hasSprite('ui/mil/plate')) r.sprite('ui/mil/plate', 0, x, PLATE_Y, plain);
    const id = this.roster[i];
    const name = id === undefined ? '- - -' : getCharacter(id).name;
    const col: Color = id === undefined ? PAL.sand[0] : this.chosenBy(i) >= 0 ? PAL.red[1] : INK;
    uiText(r, name, x + (MIL_PANEL_W >> 1), PLATE_Y + 4, col, 'center', 'small', null);
  }

  private drawBottomRow(r: Renderer): void {
    for (let p = 0; p < this.cursors.length; p++) {
      const ready = this.cursors[p].chosen !== null;
      const lit = ready || ((this.t >> 5) & 1) === 0;
      const left = p === 0;
      uiText(r, left ? 'P1' : 'P2', left ? 20 : 364, ROW_Y, SIDE_COLORS[p], left ? 'left' : 'right');
      if (lit) uiText(r, ready ? 'READY!' : 'STAND BY', left ? 36 : 348, ROW_Y, ready ? UI_GOLD : PAL.snow[2], left ? 'left' : 'right');
    }
    const secs = Math.min(99, this.secondsLeft);
    uiText(r, TWO_DIGITS[secs], r.w >> 1, ROW_Y - 1, secs <= 5 ? PAL.red[3] : PAL.gold[3], 'center', 'big');
  }
}
