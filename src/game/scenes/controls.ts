/**
 * The CONTROLS screen of the options (GDD §13.13): rebind FIRE, JUMP, BOMB and START for one key
 * set at a time (1 PLAYER, 2P PLAYER 1, 2P PLAYER 2) or for a player's gamepad (P1 PAD, P2 PAD;
 * docs/design/ams-extras.md §10). Choosing a set asks `PRESS A KEY FOR FIRE`, `… FOR JUMP`,
 * `… FOR BOMB`, `… FOR START` in turn (`ESC TO CANCEL` restores the set). A key already used by
 * another action of the same set swaps with the old key. Directions and the pause keys stay
 * fixed. Bindings are saved to the store ('bindings').
 *
 * The pad rows show each player's own pad labels (pad-prompt.ts: PlayStation ✕ ○ □ △ glyphs,
 * Xbox A B X Y, Nintendo B A Y X, generic positions) and the model of the pad the player holds;
 * a player without a pad shows the labels of the pad used last (generic positions without one).
 */
import { defaultBindings, serializeBindings, type Bindings, type Button, type KeyMap, type KeySetName, type PadMap } from '../../engine/input';
import { padInfo, type PadInfo } from '../../engine/pads';
import { PAL } from '../../engine/palette';
import type { Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { blinkOn, centerText, drawPanel, menuKeys, uiText, UI_GOLD, UI_WHITE, type GameApp } from '../app';
import { drawBase, drawScreenCursor } from './base';
import { drawHelpLine, drawPadLine, promptPad } from './pad-prompt';
import { veil } from './lake';
import { titleClock } from './title';

/** The buttons the screen rebinds, in the order it asks for them. */
export const REBIND_BUTTONS: readonly Button[] = ['fire', 'jump', 'bomb', 'start'];

type SetId = KeySetName | 'pad1' | 'pad2';
type RowId = SetId | 'reset' | 'back';

interface Row {
  id: RowId;
  label: string;
}

export const CONTROL_ROWS: readonly Row[] = [
  { id: 'solo', label: '1 PLAYER' },
  { id: 'p1', label: '2 PLAYERS - 1P' },
  { id: 'p2', label: '2 PLAYERS - 2P' },
  { id: 'pad1', label: 'P1 PAD' },
  { id: 'pad2', label: 'P2 PAD' },
  { id: 'reset', label: 'RESET TO DEFAULTS' },
  { id: 'back', label: 'BACK' },
];

/** The store key of the bindings (main.ts reads it at boot). */
export const BINDINGS_KEY = 'bindings';

const KEY_NAMES: Readonly<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Enter: 'ENTER',
  NumpadEnter: 'NUM ENTER',
  Space: 'SPACE',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  ShiftLeft: 'L SHIFT',
  ShiftRight: 'R SHIFT',
  ControlLeft: 'L CTRL',
  ControlRight: 'R CTRL',
  AltLeft: 'L ALT',
  AltRight: 'R ALT',
  Tab: 'TAB',
  Backspace: 'BACKSPACE',
};

/** A pad set's player slot. */
function padSlot(set: SetId): 0 | 1 | -1 {
  return set === 'pad1' ? 0 : set === 'pad2' ? 1 : -1;
}

/** The pad map of a pad set. */
function padMapOf(b: Bindings, slot: 0 | 1): PadMap {
  return slot === 0 ? b.pad : b.pad2;
}

/** Standard-mapping gamepad button names (Xbox style; the pad rows draw each pad's own labels). */
const PAD_NAMES: readonly string[] = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'];

/** A short upper-case name for a KeyboardEvent.code ('KeyZ' → 'Z') or a pad code ('GamepadB2' → 'X'). */
export function keyName(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  const pad = /^GamepadB(\d+)$/.exec(code);
  if (pad) return padName(Number(pad[1]));
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1];
  const num = /^Numpad(.+)$/.exec(code);
  if (num) return `NUM ${num[1].toUpperCase()}`;
  return code.toUpperCase().slice(0, 9);
}

export function padName(index: number): string {
  return PAD_NAMES[index] ?? `B${index}`;
}

/** The first binding of a button in a set, as text ('-' when unbound). */
export function bindingText(b: Bindings, set: SetId, button: Button): string {
  const ps = padSlot(set);
  if (ps >= 0) {
    const list = padMapOf(b, ps as 0 | 1)[button];
    return list.length ? padName(list[0]) : '-';
  }
  const list = b[set as KeySetName][button];
  return list.length ? keyName(list[0]) : '-';
}

/**
 * Bind `code` to `button` in a keyboard set. When another action button of the set uses the
 * code, it takes the old codes of `button` (a swap). Returns false for codes that may not be
 * bound (pause keys, the set's direction keys, pad codes).
 */
export function bindKey(b: Bindings, set: KeySetName, button: Button, code: string): boolean {
  if (code.startsWith('Gamepad') || b.pause.includes(code)) return false;
  const map: KeyMap = b[set];
  for (const dir of ['left', 'right', 'up', 'down'] as const) if (map[dir].includes(code)) return false;
  const old = map[button].slice();
  for (const other of REBIND_BUTTONS) {
    if (other === button || !map[other].includes(code)) continue;
    const rest = map[other].filter((c) => c !== code);
    map[other] = rest.length ? rest : old.filter((c) => c !== code);
  }
  map[button] = [code];
  return true;
}

/**
 * Bind a pad button index (same swap rule) in player 1's pad map, or player 2's with `slot` 1.
 * Returns false for the pad's pause buttons and directions.
 */
export function bindPad(b: Bindings, button: Button, index: number, slot: 0 | 1 = 0): boolean {
  if (b.padPause.includes(index)) return false;
  const map = padMapOf(b, slot);
  for (const dir of ['left', 'right', 'up', 'down'] as const) if (map[dir].includes(index)) return false;
  const old = map[button].slice();
  for (const other of REBIND_BUTTONS) {
    if (other === button || !map[other].includes(index)) continue;
    const rest = map[other].filter((c) => c !== index);
    map[other] = rest.length ? rest : old.filter((c) => c !== index);
  }
  map[button] = [index];
  return true;
}

/** Save the app's bindings. */
export function saveBindings(app: GameApp): void {
  app.store.set(BINDINGS_KEY, serializeBindings(app.input.bindings));
}

const TOP = 44;
const STEP = 13;
/** The value column of a pad row: the labels of FIRE JUMP BOMB START. */
const PAD_VALUES = '{FIRE} {JUMP} {BOMB} {START}';
/** Labels for a pad row before any pad was used: the generic positions. */
const GENERIC: PadInfo = padInfo('', 'standard');
const LABEL_X = 64;
const VALUE_X = 320;

export class ControlsScene implements Scene {
  private readonly app: GameApp;
  private sel = 0;
  private t = 0;
  /** Rebinding: the set, the button asked for now (index into REBIND_BUTTONS) and a backup. */
  private capture: { set: SetId; step: number; backup: string } | null = null;
  /** A short note under the panel ('SAVED', 'THAT KEY IS TAKEN') and its timer. */
  private note = '';
  private noteT = 0;
  private leaving = false;

  constructor(app: GameApp) {
    this.app = app;
  }

  /** The button being asked for (null when not rebinding). */
  get asking(): Button | null {
    return this.capture ? REBIND_BUTTONS[this.capture.step] : null;
  }

  enter(): void {
    this.app.input.suppress();
  }

  update(): void {
    this.t++;
    if (this.noteT > 0) this.noteT--;
    if (this.leaving) return;
    if (this.capture) {
      this.updateCapture();
      return;
    }
    const app = this.app;
    const k = menuKeys(app.input);
    const n = CONTROL_ROWS.length;
    if (k.up || k.down) {
      this.sel = (this.sel + (k.up ? -1 : 1) + n) % n;
      app.audio.sfx('ui/move');
    }
    if (k.back) {
      this.close();
      return;
    }
    if (!k.confirm) return;
    const row = CONTROL_ROWS[this.sel];
    if (row.id === 'back') this.close();
    else if (row.id === 'reset') {
      app.input.bindings = defaultBindings();
      saveBindings(app);
      this.say('DEFAULT CONTROLS RESTORED');
      app.audio.sfx('ui/confirm');
    } else {
      app.audio.sfx('ui/confirm');
      this.capture = { set: row.id, step: 0, backup: serializeBindings(app.input.bindings) };
    }
  }

  /** Wait for one raw key (or pad button) and bind it; Escape (or the pad's Back) cancels. */
  private updateCapture(): void {
    const app = this.app;
    const cap = this.capture;
    if (!cap) return;
    const raw = app.input.rawPressed;
    if (raw.length === 0) return;
    const code = raw[0];
    const button = REBIND_BUTTONS[cap.step];
    if (code === 'Escape' || code === 'GamepadB8') {
      app.input.bindings = JSON.parse(cap.backup) as Bindings;
      this.capture = null;
      app.input.suppress();
      app.audio.sfx('ui/cancel');
      this.say('CANCELLED');
      return;
    }
    const b = app.input.bindings;
    let ok = false;
    const ps = padSlot(cap.set);
    if (ps >= 0) {
      const m = /^GamepadB(\d+)$/.exec(code);
      ok = m !== null && bindPad(b, button, Number(m[1]), ps as 0 | 1);
    } else ok = bindKey(b, cap.set as KeySetName, button, code);
    if (!ok) {
      app.audio.sfx('ui/cancel');
      this.say(ps >= 0 ? 'PRESS A GAMEPAD BUTTON' : 'THAT KEY CANNOT BE USED');
      return;
    }
    app.audio.sfx('ui/name-letter');
    cap.step++;
    if (cap.step >= REBIND_BUTTONS.length) {
      this.capture = null;
      saveBindings(app);
      app.audio.sfx('ui/confirm');
      this.say('SAVED');
    }
    app.input.suppress();
  }

  private say(text: string): void {
    this.note = text;
    this.noteT = 120;
  }

  private close(): void {
    this.leaving = true;
    this.app.audio.sfx('ui/cancel');
    this.app.scenes.pop({ fade: 12 });
  }

  draw(r: Renderer): void {
    drawBase(r, titleClock() + this.t);
    veil(r, 0.7);
    drawPanel(r, 40, 8, 304, 200, 0.9);
    centerText(r, 'CONTROLS', 16, UI_GOLD, 'big');
    const b = this.app.input.bindings;
    for (let i = 0; i < CONTROL_ROWS.length; i++) {
      const row = CONTROL_ROWS[i];
      const y = TOP + i * STEP;
      const sel = i === this.sel && !this.capture;
      const ps = padSlot(row.id as SetId);
      const own = ps >= 0 ? this.app.input.slotPad(ps as 0 | 1) : null;
      uiText(r, own ? `${row.label} - ${own.model}` : row.label, LABEL_X, y, sel ? UI_GOLD : PAL.snow[1]);
      if (sel) drawScreenCursor(r, LABEL_X - 4, y + 3, this.t);
      if (row.id === 'reset' || row.id === 'back') continue;
      if (ps >= 0) {
        drawPadLine(r, PAD_VALUES, VALUE_X, y, this.padFor(ps as 0 | 1), padMapOf(b, ps as 0 | 1), sel ? UI_WHITE : PAL.snow[2], 'right', b.padPause);
        continue;
      }
      const v = REBIND_BUTTONS.map((btn) => bindingText(b, row.id as SetId, btn)).join(' ');
      uiText(r, v, VALUE_X, y, sel ? UI_WHITE : PAL.snow[2], 'right');
    }
    // The legend of the value column and the fixed keys.
    uiText(r, 'FIRE JUMP BOMB START', VALUE_X, TOP - 12, PAL.stone[3], 'right');
    centerText(r, 'MOVE: ARROWS / WASD   PAUSE: ESC / P', 148, PAL.stone[3]);
    drawPadLine(r, 'PAD MOVE: D-PAD / LEFT STICK   PAUSE: {START} / {PAUSE}', r.w >> 1, 160, this.padFor(0), b.pad, PAL.stone[3], 'center', b.padPause);
    centerText(r, 'PLAYER 2 JOINS: START ON A FREE PAD / KEY 2', 172, PAL.stone[3]);
    if (this.capture) this.drawCapture(r);
    else if (this.noteT > 0) centerText(r, this.note, 186, UI_GOLD);
    else drawHelpLine(r, this.app.input, 'FIRE: CHANGE   BOMB: BACK', '{OK}: CHANGE   {BACK}: BACK', 186, PAL.stone[2]);
  }

  /** The pad whose labels a pad row shows: the player's own, else the pad used last, else generic. */
  private padFor(slot: 0 | 1): PadInfo {
    return promptPad(this.app.input, slot) ?? this.app.input.gamepads?.info(this.app.input.gamepads.lastIndex) ?? GENERIC;
  }

  private drawCapture(r: Renderer): void {
    const cap = this.capture;
    if (!cap) return;
    drawPanel(r, 72, 92, 240, 48, 0.98);
    const button = REBIND_BUTTONS[cap.step].toUpperCase();
    const what = padSlot(cap.set) >= 0 ? 'PRESS A BUTTON FOR' : 'PRESS A KEY FOR';
    const label = CONTROL_ROWS.find((row) => row.id === cap.set)?.label ?? '';
    centerText(r, label, 98, PAL.sky[3]);
    if (blinkOn(this.t, 20)) centerText(r, `${what} ${button}`, 112, UI_WHITE);
    centerText(r, 'ESC TO CANCEL', 126, PAL.stone[3]);
    if (this.noteT > 0) centerText(r, this.note, 186, PAL.red[3]);
  }
}
