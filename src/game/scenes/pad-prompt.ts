/**
 * Per-pad button labels in the menus, the help lines and CONTROLS (docs/design/ams-extras.md §10;
 * engine/pads.ts `padLabel`): PlayStation ✕ ○ □ △ as drawn glyphs (`ui/pad-ps`), Xbox A B X Y
 * (in their button colours), Nintendo B A Y X (by position), a generic pad by position
 * (`ui/pad-pos`); the other buttons as text (`OPTIONS`, `MENU`, `+`, `L1` …).
 *
 * A pad line is text with tokens, each replaced by the label of the button a pad map gives the
 * action: `{FIRE}` `{JUMP}` `{BOMB}` `{START}`, `{OK}` (= jump, the south button: menus confirm
 * with it), `{BACK}` (= bomb), `{PAUSE}` (the pad pause button). Lines are parsed once and cached.
 *
 * Which pad's labels: `promptPad(input, slot)` — the slot's own pad when it has one, else the pad
 * used last; null while the keyboard was used last (the scenes then show their keyboard text).
 */
import type { Color } from '../../engine/color';
import type { InputManager, PadMap } from '../../engine/input';
import { PAL } from '../../engine/palette';
import { measure } from '../../engine/font';
import { padLabel, type PadFamily, type PadInfo, type PadLabel } from '../../engine/pads';
import type { DrawOpts, Renderer } from '../../engine/render';
import { hasSprite } from '../../engine/sprites';
import { centerText, uiText } from '../app';
import { PAD_GLYPH_W } from '../content/ui/pad.art';
import { drawScreenSprite } from './base';

type Token = 'FIRE' | 'JUMP' | 'BOMB' | 'START' | 'OK' | 'BACK' | 'PAUSE';
type Seg = string | { token: Token };

const TOKENS: ReadonlySet<string> = new Set(['FIRE', 'JUMP', 'BOMB', 'START', 'OK', 'BACK', 'PAUSE']);
const parsed = new Map<string, readonly Seg[]>();

function parse(text: string): readonly Seg[] {
  let segs = parsed.get(text);
  if (segs) return segs;
  const out: Seg[] = [];
  const re = /\{([A-Z]+)\}/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!TOKENS.has(m[1])) continue;
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push({ token: m[1] as Token });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  segs = out;
  if (parsed.size > 128) parsed.clear();
  parsed.set(text, segs);
  return segs;
}

/** The pad whose labels a menu shows (see the module comment). */
export function promptPad(input: InputManager, slot?: 0 | 1): PadInfo | null {
  if (slot !== undefined) {
    const own = input.slotPad(slot);
    if (own) return own;
  }
  return input.lastPadInfo();
}

/** The pad map of a slot (player 2's own map with slot 1). */
export function slotPadMap(input: InputManager, slot: 0 | 1 = 0): PadMap {
  return slot === 1 ? input.bindings.pad2 : input.bindings.pad;
}

/** The standard button a token stands for (−1: unbound). */
function tokenButton(t: Token, map: PadMap, pause: readonly number[]): number {
  const first = (l: readonly number[]): number => (l.length > 0 ? l[0] : -1);
  switch (t) {
    case 'FIRE':
      return first(map.fire);
    case 'JUMP':
    case 'OK':
      return first(map.jump);
    case 'BOMB':
    case 'BACK':
      return first(map.bomb);
    case 'START':
      return first(map.start);
    case 'PAUSE':
      return first(pause);
  }
}

/** Xbox face letters in their button colours (A green, B red, X blue, Y yellow). */
const XBOX_FACE: readonly Color[] = [PAL.green[3], PAL.red[3], PAL.sky[3], PAL.gold[3]];

/** A label's colour on a pad line (null: the line's colour). */
function labelColor(family: PadFamily, index: number): Color | null {
  if (family === 'xbox' && index >= 0 && index < 4) return XBOX_FACE[index];
  return null;
}

const DASH: PadLabel = { text: '-' };

function labelOf(info: PadInfo, index: number): PadLabel {
  return index < 0 ? DASH : padLabel(info.family, index, info.create);
}

/** Is the label drawn as a glyph sprite (its art registered)? */
function glyphId(l: PadLabel): string | null {
  if (!l.glyph) return null;
  const id = l.glyph === 'ps' ? 'ui/pad-ps' : 'ui/pad-pos';
  return hasSprite(id) ? id : null;
}

/** Width of one label in px. */
export function labelWidth(l: PadLabel): number {
  return glyphId(l) ? PAD_GLYPH_W : measure(l.text, 'small');
}

/** Width of a pad line in px (small font; glyphs 9 px). */
export function padLineWidth(text: string, info: PadInfo, map: PadMap, pause: readonly number[] = [8]): number {
  let w = 0;
  for (const s of parse(text)) w += typeof s === 'string' ? measure(s, 'small') : labelWidth(labelOf(info, tokenButton(s.token, map, pause)));
  return w;
}

const glyphOpts: DrawOpts = { screen: true };

/** Draw one label with its left edge at x (text top y). Returns its width. */
export function drawLabel(r: Renderer, l: PadLabel, x: number, y: number, color: Color, family?: PadFamily, index = -1): number {
  const id = glyphId(l);
  if (id) {
    drawScreenSprite(r, id, l.frame ?? 0, x, y - 1, glyphOpts);
    return PAD_GLYPH_W;
  }
  uiText(r, l.text, x, y, (family ? labelColor(family, index) : null) ?? color, 'left');
  return measure(l.text, 'small');
}

/**
 * Draw a pad line at (x, y) aligned left / center / right, the labels of `info`'s family through
 * `map` (`pause`: the pad pause buttons). Returns its width.
 */
export function drawPadLine(
  r: Renderer,
  text: string,
  x: number,
  y: number,
  info: PadInfo,
  map: PadMap,
  color: Color,
  align: 'left' | 'center' | 'right' = 'center',
  pause: readonly number[] = [8],
): number {
  const w = padLineWidth(text, info, map, pause);
  let cx = align === 'left' ? x : align === 'right' ? x - w : x - (w >> 1);
  for (const s of parse(text)) {
    if (typeof s === 'string') {
      uiText(r, s, cx, y, color, 'left');
      cx += measure(s, 'small');
      continue;
    }
    const b = tokenButton(s.token, map, pause);
    cx += drawLabel(r, labelOf(info, b), cx, y, color, info.family, b);
  }
  return w;
}

/**
 * A menu's help line: the pad line with the labels of the pad used last (or the slot's own pad),
 * else the keyboard text, centred at y.
 */
export function drawHelpLine(r: Renderer, input: InputManager, keysText: string, padText: string, y: number, color: Color, slot?: 0 | 1): void {
  const info = promptPad(input, slot);
  if (info) drawPadLine(r, padText, r.w >> 1, y, info, slotPadMap(input, slot ?? 0), color, 'center', input.bindings.padPause);
  else centerText(r, keysText, y, color);
}

/** The models of the connected pads in index order, e.g. ['DUALSENSE', 'XBOX'] (the title). */
export function connectedModels(input: InputManager, out: string[] = []): string[] {
  out.length = 0;
  const g = input.gamepads;
  if (!g) return out;
  for (let i = 0; i < 16; i++) {
    const info = g.info(i);
    if (info) out.push(info.model);
  }
  return out;
}
