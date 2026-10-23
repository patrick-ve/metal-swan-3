/**
 * FILE FM in a whole race (headless, the real scene, the bot driving) and the HUD's radio slot (the
 * ticker): the density of the DJ (news when it matters, no chatter wall), one voice at a time, the
 * playlist per lap, the finish; the ticker's still text and its scrolling caption inside its window.
 */
import { describe, expect, it } from 'vitest';
import { measure } from '../../../src/engine/font';
import type { TextOpts } from '../../../src/engine/render';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { createRadioTicker, TICKER_SCROLL, TICKER_W } from '../../../src/game/content/rally/radio/ticker';
import { RallyRadio } from '../../../src/game/rally/radio';
import { createHeadlessRally } from '../../../src/sim/headless-rally';

describe('FILE FM in a whole race (seed 1, 1P, the bot)', async () => {
  const trace: string[] = [];
  RallyRadio.traceAll = (l) => trace.push(l);
  const h = await createHeadlessRally({ seed: 1, captureConsole: true });
  h.runUntil((x) => x.done, 60 * 60 * 12);
  RallyRadio.traceAll = null;
  const rep = h.report();
  const said = trace.filter((l) => / SAY /.test(l));
  const id = (l: string): string => /(SAY|END|CUT)\s+(\S+)/.exec(l)![2];
  const sec = (l: string): number => Number(l.slice(0, 2)) * 60 + Number(l.slice(3, 7));

  it('the race completes with no errors', () => {
    expect(rep.complete).toBe(true);
    expect(rep.errors).toEqual([]);
  });

  it('the start line first; a lap line for laps 2 and 3; a finish line at the end', () => {
    expect(id(said[0])).toBe('rally/dj/start/1');
    expect(said.some((l) => /rally\/dj\/lap\/1/.test(l))).toBe(true);
    expect(said.some((l) => /rally\/dj\/lap\/[23]/.test(l))).toBe(true);
    expect(id(said[said.length - 1])).toMatch(/^rally\/dj\/finish\//);
  });

  it('one voice at a time, never the same line twice in a row', () => {
    let air = '';
    let last = '';
    for (const l of trace) {
      if (/ SAY /.test(l)) {
        expect(air, l).toBe('');
        expect(id(l), l).not.toBe(last);
        air = last = id(l);
      } else if (/ (END|CUT) /.test(l)) air = '';
    }
  });

  it('news when it matters, no chatter wall: about one line in 10–20 s, the DJ on air under a third of the time', () => {
    const total = sec(trace[trace.length - 1]);
    expect(said.length).toBeGreaterThanOrEqual(15);
    expect(said.length).toBeLessThanOrEqual(total / 10);
    let talk = 0;
    let start = -1;
    for (const l of trace) {
      if (/ SAY /.test(l)) start = sec(l);
      else if (/ (END|CUT) /.test(l) && start >= 0) {
        talk += sec(l) - start;
        start = -1;
      }
    }
    expect(talk / total).toBeLessThan(0.33);
    // No line is heard more than three times.
    const count = new Map<string, number>();
    for (const l of said) count.set(id(l), (count.get(id(l)) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(3);
  });

  it('the playlist: the three lap songs in order, jingles between', () => {
    const songs = trace.filter((l) => / SONG /.test(l)).map((l) => l.trim().split(/\s+/).pop());
    expect([...new Set(songs)]).toEqual(['rally-lap1', 'rally-lap2', 'rally-lap3']);
    expect(trace.some((l) => / JINGLE /.test(l))).toBe(true);
  });
});

/** A renderer that records the texts with their boxes. */
class Rec extends SoftRenderer {
  texts: { s: string; x0: number; x1: number }[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    const w = measure(s);
    const x0 = o?.align === 'center' ? x - w / 2 : x;
    this.texts.push({ s, x0, x1: x0 + w });
    super.text(s, x, y, o);
  }
}

describe('the HUD radio slot (the ticker)', () => {
  it('a text that fits: one still, centred text (the song title)', () => {
    const t = createRadioTicker();
    const r = new Rec();
    t.draw(r, 'FILE FM  RONDJE RING', 0, 192, 205, false);
    expect(r.texts.map((x) => x.s)).toEqual(['FILE FM  RONDJE RING']);
  });

  it('a long caption scrolls inside its window: it starts at its start, holds, moves, ends at its end', () => {
    const cap = "Acht auto's, drie rondjes, en een parkeervergunning binnen de ring!";
    for (const split of [false, true]) {
      const W = split ? TICKER_W.split : TICKER_W.full;
      expect(measure(cap)).toBeGreaterThan(W);
      const t = createRadioTicker();
      const parts: string[] = [];
      for (let now = 100; now < 100 + 600; now += 5) {
        const r = new Rec();
        t.draw(r, cap, now, 192, 205, split);
        expect(r.texts.length).toBe(1);
        const x = r.texts[0];
        // Whole glyphs inside the window only.
        expect(x.x0).toBeGreaterThanOrEqual(192 - (W >> 1) - 1);
        expect(x.x1).toBeLessThanOrEqual(192 - (W >> 1) + W + 1);
        parts.push(x.s);
      }
      expect(cap.startsWith(parts[0])).toBe(true);
      // Still during the hold.
      expect(parts[Math.floor(TICKER_SCROLL.hold / 5) - 1]).toBe(parts[0]);
      expect(cap.endsWith(parts[parts.length - 1].trimEnd())).toBe(true);
      expect(new Set(parts).size).toBeGreaterThan(3);
    }
  });
});
