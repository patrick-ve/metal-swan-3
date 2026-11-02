/**
 * Mission oat's voice lines (docs/design/oat.md §9.2: everybody speaks short Dutch lines; the bubbles
 * stay). A speaker's next bubble replaces the line that plays (src/engine/samples.ts `SpeechLane`), so
 * every bubble must last as long as its take: the builders give a voiced bubble `oatSayTicks(text)`
 * (content/samples/oat.ts), which holds the line's longest allowed take (the spec's `maxSeconds`) plus
 * a pause. Wave A has no takes: the test checks the texts fit their bubbles and the budgets fit the
 * ticks; once takes ship (wave C), each shipped take must fit too. When a take is re-picked and ships
 * longer, raise its budget (`oatLineSeconds`) and the bubble follows.
 */
import { describe, expect, it } from 'vitest';
import { measure } from '../../src/engine/font';
import { voiceKey } from '../../src/engine/samples';
import { OAT_SPEAKER } from '../../src/game/content/missions/oat/ids';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';
import { OAT_QUEUE_CALLS, OAT_QUEUE_FIRST, OAT_QUEUE_LAST, OAT_SAY_PAUSE, OAT_VOICE, oatLineSeconds, oatSayTicks, oatVoiceLines, queueCall } from '../../src/game/content/samples/oat';
import { MISSION_CARDS } from '../../src/game/content/ui/cards';
import { LINES } from '../../tools/audio/spec';

const oat = SAMPLE_MANIFEST['mission:oat']?.voice ?? {};
const boot = SAMPLE_MANIFEST.boot?.voice ?? {};

/** A shipped take's length in ticks (60 Hz), or NaN when the line has no take. */
function ticksOf(group: typeof oat, text: string): number {
  const v = group[voiceKey(text)];
  return v ? Math.ceil(v.duration * 60) : Number.NaN;
}

/** The letters the bubble font draws (no diacritics; `€` is one glyph). */
const BUBBLE_TEXT = /^[A-Z0-9 .,!?:%+€'\n-]+$/;

/** The queue steps every 300 ticks (spec §6.7): a call never runs into the next one. */
const QUEUE_STEP = 300;

describe('oat voice lines: the bubbles', () => {
  it('every voiced line fits its bubble: ≤ 24 characters × 2 lines, the font draws every letter', () => {
    const lines = oatVoiceLines();
    expect(lines.length).toBeGreaterThanOrEqual(70);
    for (const { speaker, text } of lines) {
      expect(Object.values(OAT_SPEAKER) as string[], text).toContain(speaker);
      expect(BUBBLE_TEXT.test(text), text).toBe(true);
      const rows = text.split('\n');
      expect(rows.length, text).toBeLessThanOrEqual(2);
      for (const r of rows) {
        expect(r.length, text).toBeLessThanOrEqual(24);
        expect(r, text).toBe(r.trim());
        expect(measure(r, 'small'), text).toBeLessThanOrEqual(24 * 6);
      }
    }
    // Every text once.
    expect(new Set(lines.map((l) => voiceKey(l.text))).size).toBe(lines.length);
  });

  it('the spec lines of §9.2 are all there (by speaker), the queue calls 39–60', () => {
    const by = (speaker: string): number => oatVoiceLines().filter((l) => l.speaker === speaker).length;
    expect(by(OAT_SPEAKER.barista)).toBe(4);
    expect(by(OAT_SPEAKER.makelaar)).toBe(7);
    expect(by(OAT_SPEAKER.influencer)).toBe(6);
    expect(by(OAT_SPEAKER.bakfiets)).toBe(4);
    expect(by(OAT_SPEAKER.rijStaf)).toBe(2 + 21);
    expect(by(OAT_SPEAKER.rij)).toBe(3);
    expect(by(OAT_SPEAKER.taxi)).toBe(6);
    expect(by(OAT_SPEAKER.dealer)).toBe(4);
    expect(by(OAT_SPEAKER.gids)).toBe(3);
    expect(by(OAT_SPEAKER.handhaver)).toBe(2);
    expect(by(OAT_SPEAKER.huisjesmelker)).toBe(9);
    expect(by(OAT_SPEAKER.huurder)).toBe(1);
    expect(OAT_QUEUE_FIRST).toBe(39);
    expect(OAT_QUEUE_LAST).toBe(60);
    for (let n = OAT_QUEUE_FIRST; n <= OAT_QUEUE_LAST; n++) expect(queueCall(n), String(n)).toBe(OAT_QUEUE_CALLS[n]);
    expect(queueCall(47)).toBe(OAT_VOICE.rijStaf.yourTurn);
    expect(queueCall(38)).toBeNull();
    expect(queueCall(61)).toBeNull();
  });
});

describe('oat voice lines: the takes fit the bubbles', () => {
  it("every line's time budget fits its bubble life (the take plus the pause), at least the default 120 ticks", () => {
    for (const { text } of oatVoiceLines()) {
      const l = LINES.find((x) => x.text === text)!;
      expect(l, text).toBeDefined();
      expect(l.maxSeconds, text).toBe(oatLineSeconds(text));
      expect(oatSayTicks(text), text).toBeGreaterThanOrEqual(Math.ceil((l.maxSeconds ?? 0) * 60) + OAT_SAY_PAUSE);
      expect(oatSayTicks(text), text).toBeGreaterThanOrEqual(120);
      expect(l.maxSeconds ?? 0, text).toBeGreaterThanOrEqual(1.2);
      expect(l.maxSeconds ?? 0, text).toBeLessThanOrEqual(4);
    }
  });

  it('a spoken amount, a percentage and a trailing pause get more time than the bare letters', () => {
    expect(oatLineSeconds('€1.900. EXCLUSIEF.')).toBeGreaterThan(oatLineSeconds('1900 EXCLUSIEF'));
    expect(oatLineSeconds('+10%!')).toBeGreaterThan(oatLineSeconds('+10!'));
    expect(oatLineSeconds('MIJN... MIJN\nBELEGGING...')).toBeGreaterThan(oatLineSeconds('MIJN MIJN\nBELEGGING'));
  });

  it('every number call ends before the queue steps on (300 ticks)', () => {
    for (let n = OAT_QUEUE_FIRST; n <= OAT_QUEUE_LAST; n++) expect(oatSayTicks(queueCall(n)!), String(n)).toBeLessThanOrEqual(QUEUE_STEP);
  });

  it("every shipped take (wave C) fits its bubble (none ship in wave A)", () => {
    for (const { text } of oatVoiceLines()) {
      const t = ticksOf(oat, text);
      if (Number.isNaN(t)) continue;
      expect(t + OAT_SAY_PAUSE, text).toBeLessThanOrEqual(oatSayTicks(text));
    }
  });

  it("Gusto's two card lines together fit the card (360 + 90 ticks after the typing starts)", () => {
    const card = MISSION_CARDS.find((c) => c.id === 'oat')!;
    const budget = card.briefing.reduce((s, t) => s + (LINES.find((l) => l.text === t)?.maxSeconds ?? 99), 0);
    expect(budget * 60).toBeLessThanOrEqual(360 + 90);
    const shipped = card.briefing.map((t) => ticksOf(boot, t));
    if (shipped.every((t) => !Number.isNaN(t))) expect(shipped[0] + shipped[1]).toBeLessThanOrEqual(360 + 90);
  });
});
