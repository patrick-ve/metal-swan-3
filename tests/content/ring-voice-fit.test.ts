/**
 * Mission ring's voice lines (revision R wave B, docs/design/ring.md §R.8): every voiced line has a
 * shipped ElevenLabs take (group 'mission:ring'; Gusto's card lines in 'boot'), and each bubble
 * lasts as long as its take. A speaker's next bubble replaces the line that plays (src/engine/
 * samples.ts `SpeechLane`, same speaker); a bubble without a speaker (`Boss.say`) is never cut, but
 * its text still goes when the bubble ends, so every beat covers its take (AUDIO-2: no tail any more).
 * When a take is re-picked and ships longer, lengthen its beat.
 *
 * AUDIO-1: wave A's train (the cab ZWARE JONGEN, the farmhand). AUDIO-2: the blockade's activists
 * (activists/kit.ts `ACTIVIST_SAY_TICKS`, the floor of every activist bubble) and the leader on the
 * pink boat (boot/boat.ts). The beats of the train and the boat are inline literals, so the test reads
 * them from the source. AUDIO-2 also checks that the blockade's and the boat's shipped sfx are exactly
 * the planned set (the rest stays synth).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { voiceKey } from '../../src/engine/samples';
import { ACTIVIST_SAY_TICKS } from '../../src/game/content/ring/activists/kit';
import { ACTIVIST_LINES, LEIDER_LINES, ringVoicedLines, WAVE_A_LINES } from '../../src/game/content/ring/foot/lines';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';
import { MISSION_CARDS } from '../../src/game/content/ui/cards';

const ring = SAMPLE_MANIFEST['mission:ring']?.voice ?? {};
const boot = SAMPLE_MANIFEST.boot?.voice ?? {};
const SRC = new URL('../../src/game/content/ring/zwaan/', import.meta.url);
const BOOT_SRC = new URL('../../src/game/content/ring/boot/', import.meta.url);

/** The pause after a take before its bubble goes (the blockade's and the boat's lines). */
const PAUSE = 10;

/** The shipped take's length in ticks (60 Hz), or NaN when the line has no take. */
function ticksOf(text: string): number {
  const v = ring[voiceKey(text)];
  return v ? Math.ceil(v.duration * 60) : Number.NaN;
}

/** The `ticks` of the `say(<expr>, { ..., ticks: n })` call in a zwaan source file. */
function beatOf(file: string, expr: string, dir: URL = SRC): number {
  const src = readFileSync(new URL(file, dir), 'utf8');
  const at = src.indexOf(`say(${expr},`);
  expect(at, `${file}: say(${expr}, ...)`).toBeGreaterThan(0);
  const m = /ticks:\s*(\d+)/.exec(src.slice(at, at + 120));
  expect(m, `${file}: the ticks of say(${expr})`).not.toBeNull();
  return Number(m![1]);
}

describe('ring voice lines (Dutch, shipped)', () => {
  it("every voiced line of lines.ts and the card's announcer line has a shipped take in 'mission:ring'", () => {
    const card = MISSION_CARDS.find((c) => c.id === 'ring')!;
    for (const { text } of ringVoicedLines()) expect(ring[voiceKey(text)], text).toBeDefined();
    expect(ring[voiceKey(card.announce ?? '')], card.announce).toBeDefined();
  });

  it("Gusto's two briefing lines have a take in 'boot' (the card plays before the mission's group)", () => {
    const card = MISSION_CARDS.find((c) => c.id === 'ring')!;
    for (const t of card.briefing) expect(boot[voiceKey(t)], t).toBeDefined();
  });

  it('the cab ZWARE JONGEN: each bubble lasts its take (Boss.say: no speaker lane)', () => {
    expect(ticksOf(WAVE_A_LINES.cab.rage)).toBeLessThanOrEqual(beatOf('cab.ts', 'CAB_LINES.rage'));
    expect(ticksOf(WAVE_A_LINES.cab.beaten)).toBeLessThanOrEqual(beatOf('cab.ts', 'CAB_LINES.beaten'));
  });

  it('the farmhand: each lob line and the dazed line last their takes', () => {
    const lob = beatOf('vee.ts', 'VEE_LINES.lob[Math.floor(this.lobNo / 3) % VEE_LINES.lob.length]');
    for (const t of WAVE_A_LINES.boer.lob) expect(ticksOf(t), t).toBeLessThanOrEqual(lob);
    expect(ticksOf(WAVE_A_LINES.boer.dazed)).toBeLessThanOrEqual(beatOf('vee.ts', 'VEE_LINES.dazed'));
  });

  it('the activists: every line\'s bubble floor covers its take plus a pause (kit.ts ACTIVIST_SAY_TICKS)', () => {
    for (const k of Object.keys(ACTIVIST_LINES) as (keyof typeof ACTIVIST_LINES)[]) {
      expect(ticksOf(ACTIVIST_LINES[k]) + PAUSE, k).toBeLessThanOrEqual(ACTIVIST_SAY_TICKS[k]);
    }
    // Every activist bubble goes through the floor (kit.ts `say`).
    const kit = readFileSync(new URL('../activists/kit.ts', BOOT_SRC), 'utf8');
    expect(kit).toContain('Math.max(ticks, ACTIVIST_SAY_TICKS[key])');
  });

  it('the leader on the pink boat: each bubble lasts its take plus a pause', () => {
    for (const k of ['wave', 'vreedzaam', 'drums'] as const) {
      expect(ticksOf(LEIDER_LINES[k]) + PAUSE, k).toBeLessThanOrEqual(beatOf('boat.ts', `LEIDER_LINES.${k}`, BOOT_SRC));
    }
    const src = readFileSync(new URL('boat.ts', BOOT_SRC), 'utf8');
    const m = /gagBubble\(this\.world, this, LEIDER_LINES\.lunch, (\d+),/.exec(src);
    expect(m, 'boat.ts: the lunch bubble').not.toBeNull();
    expect(ticksOf(LEIDER_LINES.lunch) + PAUSE).toBeLessThanOrEqual(Number(m![1]));
  });

  it("the blockade's and the boat's sfx: the planned ids ship takes, the rest stays synth", () => {
    const sfx = SAMPLE_MANIFEST['mission:ring']?.sfx ?? {};
    const shipped = Object.keys(sfx).filter((id) => /^ring\/(act|blok|boot)\//.test(id));
    const STAY_SYNTH = ['ring/act/squeal-tell', 'ring/act/squeal-out', 'ring/act/huff', 'ring/act/hum', 'ring/act/lift', 'ring/boot/feedback'];
    for (const id of STAY_SYNTH) expect(shipped, id).not.toContain(id);
    expect(shipped.length).toBe(33);
  });
});
