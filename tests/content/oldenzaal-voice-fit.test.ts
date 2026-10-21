/**
 * Mission oldenzaal's voice lines (revision 3, the user 2026-10-21: every bubble and every voiced
 * line of the mission is Dutch, and the ElevenLabs takes ship). A speaker's next bubble replaces
 * the line that plays (src/engine/samples.ts `SpeechLane`), so each scene beat must last at least
 * as long as its shipped take; else the voice is cut off mid-word. When a take is re-picked on the
 * review page and ships longer, lengthen its beat (WU_SCENE.lineTicks, WAKE.lines).
 */
import { describe, expect, it } from 'vitest';
import { voiceKey } from '../../src/engine/samples';
import { OLDENZAAL } from '../../src/game/content/missions/oldenzaal/index';
import { SNACK_POWER_CALLOUT, voicedLines, WINKEL_WAKE_LINES, WU_CALL, WU_LINES } from '../../src/game/content/missions/oldenzaal/lines';
import { WAKE } from '../../src/game/content/missions/oldenzaal/script-oz-c';
import { WU_SCENE } from '../../src/game/content/oldenzaal/npcs/index';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';

const voices = SAMPLE_MANIFEST['mission:oldenzaal']?.voice ?? {};

/** The shipped take's length in ticks (60 Hz), or NaN when the line has no take. */
function ticksOf(text: string): number {
  const v = voices[voiceKey(text)];
  return v ? Math.ceil(v.duration * 60) : Number.NaN;
}

describe('oldenzaal voice lines (Dutch, shipped)', () => {
  it('every voiced line, the announcer line and the snack callout has a shipped take', () => {
    const texts = [...voicedLines().map((l) => l.text), OLDENZAAL.announce ?? '', SNACK_POWER_CALLOUT];
    for (const t of texts) expect(voices[voiceKey(t)], t).toBeDefined();
  });

  it("Meneer Wu's call and lines fit their beats (his next line never cuts one off)", () => {
    expect(ticksOf(WU_CALL)).toBeLessThanOrEqual(WU_SCENE.callTicks);
    expect(WU_SCENE.lineTicks.length).toBe(WU_LINES.length);
    WU_LINES.forEach((line, i) => expect(ticksOf(line) + 10, line).toBeLessThanOrEqual(WU_SCENE.lineTicks[i]));
  });

  it("Mevrouw Winkel's wake lines fit their beats (the last one ends before her laugh)", () => {
    expect(WAKE.lines.length).toBe(WINKEL_WAKE_LINES.length);
    expect(ticksOf(WINKEL_WAKE_LINES[0]) + 8).toBeLessThanOrEqual(WAKE.lines[0]);
    expect(ticksOf(WINKEL_WAKE_LINES[1]) + 8).toBeLessThanOrEqual(WAKE.lines[1]);
    expect(ticksOf(WINKEL_WAKE_LINES[2])).toBeLessThanOrEqual(WAKE.lines[2] - 30);
  });
});
