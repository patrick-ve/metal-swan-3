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
 * Sequence (docs/design/select40.md): all shutters closed; after SHUTTER_DELAY ticks they rise
 * one after another (SHUTTER_STAGGER apart, `ui/mil-shutter`), easing out into a small bounce at
 * the top (SHUTTER_RISE), showing the unlit portraits (`char/<id>/select-grey`); the highlighted
 * one plays its lit loop (`char/<id>/select`, from its key pose at each highlight) and its lamp
 * lights with a glow halo and a blink (`ui/move` on a change). Confirm: `ui/select-confirm` and
 * the name callout; the pick reaction (`char/<id>/select-pick`) plays once with a white flash on
 * its first FLASH_TICKS and holds its last frame; when it ends (its total time from the sprite
 * durations; FLASH_TICKS without one) the shutter falls (SHUTTER_DROP), slams down with a squash
 * (`ui/mil/shutter-slam`), a 1-px shake and dust puffs (`ui/mil/dust`), `ui/mil-clank` as it
 * lands, and a glass preview window on it shows the soldier's in-game idle (legs-idle +
 * torso-pistol-idle) behind reflections, over a hazard strip. A soldier the other player took
 * cannot be picked (`ui/cancel`). When every player has chosen and every shutter is down, the
 * screen holds CONFIRM_HOLD ticks, then the campaign starts (`startCampaign`). The timer
 * (SELECT_SECONDS) picks the highlighted (or the next free) soldier at 0. Back (bomb) before any
 * pick: the mode select.
 *
 * Art: the furniture and the portraits are 1× art (pixel grid path B), drawn like any 1× sprite
 * at every art tier; each preview figure draws at the art tier of its group (base.ts
 * `screenArt`). A character without select art shows its 32 × 32 portrait on a dark panel (the
 * retired heroes, tests).
 *
 * Gamepads (docs/design/ams-extras.md §10): with 2 players each pad drives its own player's
 * cursor. START or the south button on a free pad claims the first player without a pad (that
 * press does nothing else); while a free pad is connected, a player without a pad who is still
 * choosing blinks `PRESS START` in the bottom row instead of `STAND BY`. The keyboard sets keep
 * working for both.
 */
import type { Color } from '../../engine/color';
import { measure } from '../../engine/font';
import { PAD } from '../../engine/pads';
import { INK, PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { frameCount, frameW, getFrame, hasSprite, setArtDensity, spriteAnim, type ArtDensity } from '../../engine/sprites';
import { centerText, menuKeys, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
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
  MIL_SLAM_TICKS,
  MIL_TITLE_RECESS,
  milPanelX,
  milShutterFrame,
  stencilId,
} from '../content/ui/military.art';
import { getCharacter, hasCharacter, listCharacters, type CharacterDef } from '../registry';
import { CHARACTER_TEXTS, ROSTER } from './flow-data';
import { startCampaign } from './flow';
import { ModeSelectScene } from './mode-select';
import { screenArt } from './base';

/** 60 seconds to choose (the user, 2026-11-04: more time to pick a soldier; GDD §13.5 had 20). */
export const SELECT_SECONDS = 60;
/** The shutters stay closed this long after the screen opens, then rise one by one. */
export const SHUTTER_DELAY = 20;
export const SHUTTER_STAGGER = 8;
/** Ticks per shutter step (rising and dropping). */
export const SHUTTER_TICKS = 2;
/**
 * The rise: px the door is raised at each step (SHUTTER_TICKS each): a jolt, fast, easing out
 * into the top stop, a small bounce back down and up again. Every value is a shutter frame
 * offset (MIL_SHUTTER_OFFSETS).
 */
export const SHUTTER_RISE: readonly number[] = [0, 2, 8, 18, 32, 50, 70, 90, 106, 118, 126, 128, 120, 114, 116, 122, 128];
/** The drop: the door falls faster and faster (SHUTTER_TICKS per step) and lands at 0. */
export const SHUTTER_DROP: readonly number[] = [128, 126, 118, 106, 90, 70, 50, 18, 0];
/** Ticks per impact frame (`ui/mil/shutter-slam`) after the door lands (the art's own speed). */
export const SLAM_TICKS = MIL_SLAM_TICKS;
/** A lit P1 / P2 lamp blinks bright LAMP_BLINK ticks every LAMP_PERIOD; the two sides LAMP_PHASE ticks apart. */
const LAMP_PERIOD = 72;
const LAMP_BLINK = 4;
const LAMP_PHASE = 23;
/** The 1-px shake of a landed door, per tick after the impact (px down). */
export const SHAKE: readonly number[] = [1, 0, 1, 0];
/** The white flash at the start of the pick reaction. */
export const FLASH_TICKS = 2;
/** Ticks from the drop's start until the door lands (the preview shows, `ui/mil-clank`). */
export const DROP_TICKS = (SHUTTER_DROP.length - 1) * SHUTTER_TICKS;
/** A confirmed shutter of a soldier without a pick reaction is down this many ticks after the confirm. */
export const DROP_DONE = FLASH_TICKS + DROP_TICKS;
/** Every shutter down: the screen holds this long before the campaign starts. */
export const CONFIRM_HOLD = 40;
/** After the last confirm (no pick reaction): the shutter drops, then the screen holds CONFIRM_HOLD ticks. */
export const CONFIRM_TICKS = DROP_DONE + CONFIRM_HOLD;

/** Total ticks of one pass of a strip (its durations, else ticksPerFrame per frame); 0 for an unknown id. */
export function stripTotal(id: string): number {
  if (!hasSprite(id)) return 0;
  const n = frameCount(id);
  const a = spriteAnim(id);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.max(1, Math.round(a.durations?.[i % a.durations.length] ?? a.ticksPerFrame));
  return total;
}

/** The frame of a strip `age` ticks after it started: looping, or held on its last frame (`once`). */
export function stripFrameAt(id: string, age: number, once = false): number {
  const n = hasSprite(id) ? frameCount(id) : 0;
  if (n <= 1) return 0;
  const a = spriteAnim(id);
  const total = stripTotal(id);
  let t = once ? Math.max(0, age) : ((age % total) + total) % total;
  if (once && t >= total) return n - 1;
  for (let i = 0; i < n; i++) {
    t -= Math.max(1, Math.round(a.durations?.[i % a.durations.length] ?? a.ticksPerFrame));
    if (t < 0) return i;
  }
  return n - 1;
}

/** Ticks of a character's pick reaction (`<art>/select-pick`); 0 without one. */
export function pickTicks(id: string): number {
  return stripTotal(`${getCharacter(id).art}/select-pick`);
}
/**
 * Bio ticker: one line at the foot of the window, over the collar only (the face, the mouth and
 * the chin of the portrait stay clear: they carry the likeness and the loop's twitches). It slides
 * up BIO_DELAY ticks after a highlight, types the callsign and then each bio line in turn (each
 * held BIO_LINE_HOLD ticks), slides down, rests BIO_REST ticks and starts again.
 */
export const BIO_DELAY = 48;
/** The ticker's height: it covers the panel rows from BIO_TOP down to the bottom of the window. */
export const BIO_H = 11;
export const BIO_TOP = MIL_PANEL_H - BIO_H;
const BIO_SLIDE = 6;
const BIO_LINE_HOLD = 70;
const BIO_REST = 60;
/** Ticks per typed character. */
const TYPE_TICKS = 1;
/** Text width in the ticker. */
const BIO_W = MIL_PANEL_W - 4;

const TITLE = 'REPORT FOR DUTY';
/** The top of the title sprite: its letters (16 px, 3 px of overspray above) centred in the recess. */
const TITLE_Y = MIL_TITLE_RECESS.y + ((MIL_TITLE_RECESS.h - 16) >> 1) - 3;
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
  /** Per ticker line (the callsign lines, then the bio lines): the x offset after each character (for the typing cover). */
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
  const call = callsign ? wrapSmall(callsign, width).slice(0, 2) : [];
  const stops = [...call, ...lines].map((l) => {
    const out: number[] = [];
    for (let i = 1; i <= l.length; i++) out.push(measure(l.slice(0, i), 'small'));
    return out;
  });
  b = { callsign: call, lines, stops };
  bioCache.set(id, b);
  return b;
}

/** The sprite ids a panel draws (built once per screen, no string building per frame). */
interface PanelArt {
  select: string;
  grey: string;
  pick: string;
  portrait: string;
  legs: string;
  torso: string;
}

function panelArt(id: string): PanelArt {
  const art = getCharacter(id).art;
  return {
    select: `${art}/select`,
    grey: `${art}/select-grey`,
    pick: `${art}/select-pick`,
    portrait: `${art}/portrait`,
    legs: `${art}/legs-idle`,
    torso: `${art}/torso-pistol-idle`,
  };
}

/** The military furniture of the screen (1× art; one screen-art group). */
export const MIL_ART: readonly string[] = [
  'ui/mil/frame',
  stencilId(TITLE),
  'ui/mil/shutter',
  'ui/mil/shutter-slam',
  'ui/mil/dust',
  'ui/mil/badge-off',
  'ui/mil/badge-p1',
  'ui/mil/badge-p2',
  'ui/mil/glow-p1',
  'ui/mil/glow-p2',
  'ui/mil/plate',
  'ui/mil/preview',
  'ui/mil/preview-glare',
  'ui/mil/hazard',
];

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
const glowOpts: DrawOpts = { screen: true, blend: 'add', alpha: 0.6 };
const glareOpts: DrawOpts = { screen: true, blend: 'add', alpha: 0.45 };
const dustL: DrawOpts = { screen: true, flipX: true };
const engraved: Color = PAL.sand[3];

export class CharacterSelectScene implements Scene {
  private readonly app: GameApp;
  readonly players: 1 | 2;
  readonly roster: string[];
  private readonly art: PanelArt[];
  /** The portraits (one screen-art group) and each soldier's preview figure (legs, torso). */
  private readonly portraitIds: string[];
  /** Ticks of each panel's pick reaction (0: none). */
  private readonly pickT: number[];
  private readonly previewIds: string[][];
  /** The screen density of the furniture this frame (set at the top of draw). */
  private mil: ArtDensity = 1;
  private readonly cursors: Cursor[];
  private left = SELECT_SECONDS * 60;
  private t = 0;
  private leaving = false;

  constructor(app: GameApp, players: 1 | 2 = 1) {
    this.app = app;
    this.players = players;
    this.roster = selectRoster();
    this.art = this.roster.map(panelArt);
    this.portraitIds = this.art.flatMap((a) => [a.select, a.grey, a.pick, a.portrait]).filter(hasSprite);
    this.pickT = this.art.map((a) => stripTotal(a.pick));
    this.previewIds = this.art.map((a) => [a.legs, a.torso]);
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

  /** The px panel i's door is raised now (0 closed … 128 fully raised; panels without a soldier stay closed). */
  shutterOffset(i: number): number {
    if (i >= this.roster.length) return 0;
    const k = Math.floor((this.t - SHUTTER_DELAY - i * SHUTTER_STAGGER) / SHUTTER_TICKS);
    const open = k < 0 ? 0 : SHUTTER_RISE[Math.min(k, SHUTTER_RISE.length - 1)];
    const p = this.chosenBy(i);
    if (p < 0) return open;
    const d = this.cursors[p].chosenT - this.dropStart(p);
    if (d < 0) return open;
    return Math.min(open, SHUTTER_DROP[Math.min(SHUTTER_DROP.length - 1, Math.floor(d / SHUTTER_TICKS))]);
  }

  /** The shutter frame of panel i: 0 closed … MIL_SHUTTER_FRAMES − 1 fully raised. */
  shutterFrame(i: number): number {
    return milShutterFrame(this.shutterOffset(i));
  }

  /** Ticks of the pick reaction player p plays (0: none, or not chosen). */
  pickTicksOf(p: number): number {
    const c = this.cursors[p];
    if (!c?.chosen) return 0;
    return this.pickT[this.roster.indexOf(c.chosen)] ?? 0;
  }

  /** Ticks after player p's confirm when the door starts to fall: the pick reaction's end (FLASH_TICKS at least). */
  dropStart(p: number): number {
    return Math.max(FLASH_TICKS, this.pickTicksOf(p));
  }

  /** Ticks after player p's confirm when the door lands (the preview shows, the clank). */
  dropDone(p: number): number {
    return this.dropStart(p) + DROP_TICKS;
  }

  /** Is player p's preview window showing (chosen, and the shutter is down)? */
  previewShown(p: number): boolean {
    const c = this.cursors[p];
    return !!c?.chosen && c.chosenT >= this.dropDone(p);
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    const app = this.app;
    // A rattle as each shutter starts to rise.
    for (let i = 0; i < this.roster.length && i < MIL_PANELS; i++) if (this.t === SHUTTER_DELAY + i * SHUTTER_STAGGER) app.audio.sfx('ui/mil-shutter');
    if (this.players === 2) this.claimPads();
    for (let p = 0; p < this.cursors.length; p++) {
      const c = this.cursors[p];
      if (c.chosen) {
        c.chosenT++;
        if (c.chosenT === this.dropDone(p)) app.audio.sfx('ui/mil-clank');
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
    if (this.cursors.every((c, p) => c.chosen && c.chosenT >= this.dropDone(p) + CONFIRM_HOLD)) {
      this.leaving = true;
      startCampaign(app, { players: this.players, characters: this.cursors.map((c) => c.chosen ?? 'recruit') });
    }
  }

  /**
   * 2 players: START or the south button on a free pad claims the first player without a pad
   * (P1 first). The claiming press is hidden from that player's cursor.
   */
  private claimPads(): void {
    const input = this.app.input;
    const gp = input.freePadPressed(PAD.start, PAD.south);
    if (gp < 0) return;
    const slot = !input.slotHasPad(0) ? 0 : !input.slotHasPad(1) ? 1 : -1;
    if (slot < 0) return;
    input.claimPad(slot as 0 | 1, gp);
    this.app.audio.sfx('ui/move');
  }

  /** Player p has no pad while a free pad is connected (2 players): the bottom row asks for START. */
  wantsPad(p: number): boolean {
    const input = this.app.input;
    return this.players === 2 && !input.slotHasPad(p as 0 | 1) && input.freePads() > 0;
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
    // Portraits, furniture and previews at the screen density of their group (the portraits and
    // the furniture are 1× art: they draw their 1× frames at every tier).
    const prev = setArtDensity(screenArt(r, this.portraitIds));
    for (let i = 0; i < n; i++) this.drawPortrait(r, i);
    this.mil = screenArt(r, MIL_ART);
    setArtDensity(this.mil);
    for (let i = 0; i < MIL_PANELS; i++) {
      if (i < n && this.shutterFrame(i) > 0) this.drawBio(r, i);
      this.drawShutter(r, i);
    }
    if (hasSprite('ui/mil/frame')) r.sprite('ui/mil/frame', 0, 0, 0, plain);
    const sid = stencilId(TITLE);
    if (hasSprite(sid)) r.sprite(sid, 0, (r.w - frameW(getFrame(sid, 0))) >> 1, TITLE_Y, plain);
    else centerText(r, TITLE, 10, UI_GOLD, 'big');
    for (let i = 0; i < MIL_PANELS; i++) {
      this.drawDust(r, i);
      this.drawBadges(r, i);
      this.drawPlate(r, i);
    }
    setArtDensity(prev);
    this.drawBottomRow(r);
  }

  /** The tick panel i was last highlighted by a player still choosing (its lit loop starts there). */
  private litSince(i: number): number {
    let since = 0;
    for (const c of this.cursors) if (!c.chosen && c.index === i && c.since > since) since = c.since;
    return since;
  }

  /** The portrait sprite and frame panel i shows now (null: no select art). */
  portraitAt(i: number): { id: string; frame: number } | null {
    const art = this.art[i];
    if (!art || !hasSprite(art.select)) return null;
    const p = this.chosenBy(i);
    if (p >= 0) {
      // Chosen: the pick reaction once, held on its last frame (the lit key pose without one).
      if (!hasSprite(art.pick)) return { id: art.select, frame: 0 };
      return { id: art.pick, frame: stripFrameAt(art.pick, this.cursors[p].chosenT, true) };
    }
    if (this.highlighted(i)) return { id: art.select, frame: stripFrameAt(art.select, this.t - this.litSince(i)) };
    // Unlit: the grey state (a slow breath when it has two frames), out of step per panel.
    if (hasSprite(art.grey)) return { id: art.grey, frame: stripFrameAt(art.grey, this.t + i * 37) };
    return { id: art.select, frame: 0 };
  }

  private drawPortrait(r: Renderer, i: number): void {
    const art = this.art[i];
    const x = milPanelX(i);
    const y = MIL_PANEL_Y;
    const lit = this.highlighted(i);
    const p = this.chosenBy(i);
    const flash = p >= 0 && this.cursors[p].chosenT < FLASH_TICKS;
    const at = this.portraitAt(i);
    if (at) {
      r.sprite(at.id, at.frame, x, y, plain);
      // No grey art: the colour portrait dimmed.
      if (!lit && at.id === art.select) r.sprite(at.id, at.frame, x, y, greyOpts);
      if (flash) r.sprite(at.id, at.frame, x, y, flashOpts);
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

  /**
   * The bio ticker of panel i now: its top row on screen, the slide (0: fully up), the ticker line
   * and how many of its characters are typed; null when it is not shown. Only on a panel that is
   * highlighted by a player still choosing and not chosen yet (a chosen panel plays its pick).
   */
  bioAt(i: number): { y: number; slide: number; line: number; typed: number } | null {
    if (i >= this.roster.length || this.chosenBy(i) >= 0 || this.shutterFrame(i) <= 0) return null;
    let c: Cursor | null = null;
    for (let p = 0; p < this.cursors.length; p++) {
      const q = this.cursors[p];
      if (!q.chosen && q.index === i && (!c || q.since > c.since)) c = q;
    }
    if (!c) return null;
    const age = this.t - c.since;
    if (age < BIO_DELAY) return null;
    const b = bioText(this.roster[i]);
    const n = b.stops.length;
    if (!n) return null;
    // One cycle: slide up, per line (type it, hold it), slide down, rest.
    let up = BIO_SLIDE;
    for (const st of b.stops) up += st.length * TYPE_TICKS + BIO_LINE_HOLD;
    const phase = (age - BIO_DELAY) % (up + BIO_SLIDE + BIO_REST);
    if (phase >= up + BIO_SLIDE) return null;
    const slide = phase < BIO_SLIDE ? BIO_SLIDE - phase : phase >= up ? phase - up + 1 : 0;
    let left = phase - BIO_SLIDE;
    let line = 0;
    if (left >= 0) {
      while (line < n - 1 && left >= b.stops[line].length * TYPE_TICKS + BIO_LINE_HOLD) left -= b.stops[line++].length * TYPE_TICKS + BIO_LINE_HOLD;
    } else left = phase >= up ? 1e9 : 0;
    const typed = Math.min(b.stops[line].length, Math.max(0, Math.floor(left / TYPE_TICKS)));
    const y = MIL_PANEL_Y + BIO_TOP + Math.ceil((slide * BIO_H) / BIO_SLIDE);
    return { y, slide, line: phase >= up ? n - 1 : line, typed: phase >= up ? b.stops[n - 1].length : typed };
  }

  /** The bio ticker at the foot of a panel highlighted by a player still choosing. */
  private drawBio(r: Renderer, i: number): void {
    const at = this.bioAt(i);
    if (!at) return;
    const b = bioText(this.roster[i]);
    const x = milPanelX(i);
    r.rect(x, at.y, MIL_PANEL_W, BIO_H, PAL.ink[1], boxOpts);
    r.rect(x, at.y, MIL_PANEL_W, 1, PAL.gold[0], plain);
    if (at.slide > 0 || at.typed <= 0) return;
    const call = at.line < b.callsign.length;
    const text = call ? b.callsign[at.line] : b.lines[at.line - b.callsign.length];
    const ly = at.y + 3;
    uiText(r, text, x + 2, ly, call ? UI_GOLD : PAL.snow[2], 'left', 'small', null);
    const stops = b.stops[at.line];
    if (at.typed < stops.length) {
      // Cover the part not typed yet; a block cursor blinks at the typing point.
      const cx = x + 2 + stops[at.typed - 1] + 1;
      r.rect(cx, ly - 1, x + MIL_PANEL_W - cx, BIO_H - 2, PAL.ink[1], plain);
      if ((this.t >> 3) & 1) r.rect(cx, ly, 4, 7, PAL.snow[2], plain);
    }
  }

  /** Ticks since panel i's door landed (-1: it has not landed: not chosen, or still falling). */
  private landedFor(i: number): number {
    const p = this.chosenBy(i);
    if (p < 0) return -1;
    const d = this.cursors[p].chosenT - this.dropDone(p);
    return d >= 0 ? d : -1;
  }

  private drawShutter(r: Renderer, i: number): void {
    if (!hasSprite('ui/mil/shutter')) return;
    const f = this.shutterFrame(i);
    if (f >= MIL_SHUTTER_FRAMES - 1) return;
    const sx = milPanelX(i) + MIL_SHUTTER_DX;
    const land = this.landedFor(i);
    // The impact: the 1-px shake and the squash frames (the slats bunch, then settle).
    const sy = MIL_PANEL_Y + MIL_SHUTTER_DY + (land >= 0 && land < SHAKE.length ? SHAKE[land] : 0);
    const slam = land >= 0 && land < stripTotal('ui/mil/shutter-slam');
    if (slam) r.sprite('ui/mil/shutter-slam', stripFrameAt('ui/mil/shutter-slam', land, true), sx, sy, plain);
    else r.sprite('ui/mil/shutter', f, sx, sy, plain);
    const p = this.chosenBy(i);
    if (p >= 0 && this.previewShown(p)) this.drawPreview(r, p, sx, sy);
  }

  /** Dust puffs out from under a landed door, both sides (over the frame). */
  private drawDust(r: Renderer, i: number): void {
    const land = this.landedFor(i);
    if (land < 0 || !hasSprite('ui/mil/dust')) return;
    if (land >= stripTotal('ui/mil/dust')) return;
    const f = stripFrameAt('ui/mil/dust', land, true);
    const x = milPanelX(i);
    const y = MIL_PANEL_Y + MIL_PANEL_H - 9;
    r.sprite('ui/mil/dust', f, x - 12, y, dustL);
    r.sprite('ui/mil/dust', f, x + MIL_PANEL_W - 12, y, plain);
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
    // The soldier's in-game idle (the 40 px hero) at the art tier of its group.
    const age = c.chosenT - this.dropDone(p);
    setArtDensity(screenArt(r, this.previewIds[this.roster.indexOf(c.chosen ?? '')]));
    const lf = stripFrameAt(legs, age);
    const hip = getFrame(legs, lf, 1).pts?.hip;
    r.sprite(legs, lf, fx, fy, plain);
    r.sprite(torso, stripFrameAt(torso, age), fx + (hip?.[0] ?? 0), fy + (hip?.[1] ?? -14), plain);
    setArtDensity(this.mil);
    // Reflections on the glass, over the figure.
    if (hasSprite('ui/mil/preview-glare')) r.sprite('ui/mil/preview-glare', 0, px, py, glareOpts);
  }

  private drawBadges(r: Renderer, i: number): void {
    const x = milPanelX(i);
    for (let side = 0; side < 2; side++) {
      const bx = x + 3 + side * 30;
      const c = this.cursors[side];
      // A lamp blinks while its shutter is still closed, and burns steady once the panel is open.
      const on = this.badgeLit(side, i) && (c.chosen !== null || this.shutterFrame(i) > 0 || ((this.t >> 3) & 1) === 1);
      const id = on ? (side === 0 ? 'ui/mil/badge-p1' : 'ui/mil/badge-p2') : 'ui/mil/badge-off';
      if (on) {
        const glow = side === 0 ? 'ui/mil/glow-p1' : 'ui/mil/glow-p2';
        if (hasSprite(glow)) r.sprite(glow, 0, bx - 4, BADGE_Y - 4, glowOpts);
      }
      if (hasSprite(id)) r.sprite(id, on ? this.lampFrame(side) : 0, bx, BADGE_Y, plain);
      else if (on) uiText(r, side === 0 ? 'P1' : 'P2', bx + 14, BADGE_Y + 2, SIDE_COLORS[side], 'center');
    }
  }

  /** A lit lamp's frame: steady (0), with a short bright blink (1) now and then, out of step per side. */
  lampFrame(side: number): number {
    return (this.t + side * LAMP_PHASE) % LAMP_PERIOD < LAMP_BLINK ? 1 : 0;
  }

  private drawPlate(r: Renderer, i: number): void {
    const x = milPanelX(i);
    if (hasSprite('ui/mil/plate')) r.sprite('ui/mil/plate', 0, x, PLATE_Y, plain);
    const id = this.roster[i];
    const name = id === undefined ? '- - -' : getCharacter(id).name;
    const col: Color = id === undefined ? PAL.sand[0] : this.chosenBy(i) >= 0 ? PAL.red[1] : INK;
    // Stencilled into the plate: a lit lip under the letters.
    uiText(r, name, x + (MIL_PANEL_W >> 1), PLATE_Y + 5, engraved, 'center', 'small', null);
    uiText(r, name, x + (MIL_PANEL_W >> 1), PLATE_Y + 4, col, 'center', 'small', null);
  }

  private drawBottomRow(r: Renderer): void {
    for (let p = 0; p < this.cursors.length; p++) {
      const ready = this.cursors[p].chosen !== null;
      const lit = ready || ((this.t >> 5) & 1) === 0;
      const left = p === 0;
      uiText(r, left ? 'P1' : 'P2', left ? 20 : 364, ROW_Y, SIDE_COLORS[p], left ? 'left' : 'right');
      const ask = !ready && this.wantsPad(p);
      if (lit) uiText(r, ready ? 'READY!' : ask ? 'PRESS START' : 'STAND BY', left ? 36 : 348, ROW_Y, ready ? UI_GOLD : ask ? UI_WHITE : PAL.snow[2], left ? 'left' : 'right');
    }
    const secs = Math.min(99, this.secondsLeft);
    uiText(r, TWO_DIGITS[secs], r.w >> 1, ROW_Y - 1, secs <= 5 ? PAL.red[3] : PAL.gold[3], 'center', 'big');
  }
}
