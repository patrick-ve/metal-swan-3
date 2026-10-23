/**
 * The radio slot of the rally HUD (RADIO, wave C; docs/design/rally.md §7.6, §8; docs/api/rally.md
 * "C.R The radio"): FILE FM's ticker, bottom centre of the frame (in 2P once, in the lower view). The
 * text is `RallyScene.ticker`, written by the radio's director (src/game/rally/radio.ts):
 * `FILE FM  <song title>` (grey), the slogan during a jingle, `FILE FM  - GEEN BEREIK -` in a tunnel,
 * or the DJ's line while it plays (white: a caption).
 *
 * A text that fits the window shows still and centred on a panel as wide as the text (RULES' wave-B
 * panel). A longer caption scrolls inside a fixed window like a car radio's display: it holds at its
 * start, then moves left at a reading pace until its end shows, and holds there. The window shows only
 * whole glyphs (the renderer has no clip): one text call of the visible part per frame; the part is
 * cut again only when it changes. Readable at 1×; 196 px wide in 2P (clear of the map and KM/H).
 *
 * Cosmetic; the time base is the race's tick (it stops in the pause).
 */
import type { Color } from '../../../../engine/color';
import { measure } from '../../../../engine/font';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { UI_GREY, UI_WHITE, uiText } from '../../../app';
import { RADIO_STATION } from './lines';

/** The window's width (logical px) in the full view and in a split view; the panel is 8 px wider. */
export const TICKER_W = { full: 242, split: 196 } as const;
/** A long caption holds this many ticks at its start, then moves this many px per tick. */
export const TICKER_SCROLL = { hold: 45, speed: 0.6 } as const;

const INK_PANEL: Color = 0x05060aff;
const PANEL: DrawOpts = { screen: true, alpha: 0.7 };

export interface RadioTickerSlot {
  /** Draw `text` with its baseline row at `y`, centred on `cx`; `now` is the race tick. */
  draw(r: Renderer, text: string, now: number, cx: number, y: number, split: boolean): void;
}

/** The ticker's state: one per HUD (the scene draws the ticker once per frame). */
export function createRadioTicker(): RadioTickerSlot {
  let text = '';
  let t0 = 0;
  let width = 0;
  let left: number[] = [];
  let right: number[] = [];
  let partA = -1;
  let partB = -1;
  let part = '';

  /** The glyph edges of a new text (once per text). */
  function layout(s: string, now: number): void {
    text = s;
    t0 = now;
    width = measure(s);
    left = [];
    right = [];
    for (let i = 0; i < s.length; i++) {
      const l = i === 0 ? 0 : measure(s.slice(0, i + 1)) - measure(s[i]);
      left.push(l);
      right.push(l + measure(s[i]));
    }
    partA = partB = -1;
  }

  return {
    draw(r, s, now, cx, y, split) {
      if (!s) return;
      if (s !== text) layout(s, now);
      const caption = !s.startsWith(RADIO_STATION);
      const col = caption ? UI_WHITE : UI_GREY;
      const W = split ? TICKER_W.split : TICKER_W.full;
      if (width <= W) {
        const tw = width + 8;
        r.rect(cx - (tw >> 1), y - 2, tw, 11, INK_PANEL, PANEL);
        uiText(r, s, cx, y, col, 'center');
        return;
      }
      // A long caption: the scroll offset, then the whole glyphs inside the window.
      const over = width - W;
      const off = Math.max(0, Math.min(over, (now - t0 - TICKER_SCROLL.hold) * TICKER_SCROLL.speed));
      const x0 = cx - (W >> 1);
      r.rect(x0 - 4, y - 2, W + 8, 11, INK_PANEL, PANEL);
      let a = 0;
      while (a < s.length && left[a] < off) a++;
      let b = s.length - 1;
      while (b > a && right[b] > off + W) b--;
      if (a !== partA || b !== partB) {
        partA = a;
        partB = b;
        part = s.slice(a, b + 1);
      }
      if (a < s.length) uiText(r, part, Math.round(x0 + left[a] - off), y, col);
    },
  };
}
