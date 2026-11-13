/**
 * Mission sewers' voice lines (docs/design/sewers.md §7; the ElevenLabs takes of the audio wave P3,
 * 2026-11-12). A voiced bubble lives `sewersSayTicks(text)` ticks: the longest take allowed
 * (`sewersLineSeconds`) plus `SEWERS_SAY_PAUSE`. A speaker's next bubble replaces the line that plays
 * (src/engine/samples.ts `SpeechLane`), so a scripted beat must outlast the take before it; else the
 * voice is cut off mid-word. When a take is re-picked and ships longer, lengthen its beat.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceKey } from '../../src/engine/samples';
import { SEWERS_CARD } from '../../src/game/content/missions/sewers/card';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';
import { SEWERS_SAY_PAUSE, SEWERS_VOICE, sewersLineSeconds, sewersSayTicks, sewersVoiceLines } from '../../src/game/content/samples/sewers';
import { WORKER_GAG } from '../../src/game/content/sewers/street/hostages';

const own = SAMPLE_MANIFEST['mission:sewers']?.voice ?? {};
const boot = SAMPLE_MANIFEST.boot?.voice ?? {};
/** The heroes' lines (the hero at the wagon's wheel, the P1 hero) stay text-only bubbles: the five heroes are never voiced. */
const HEROES: readonly string[] = Object.values(SEWERS_VOICE.hero);
const voiced = sewersVoiceLines().filter((l) => !HEROES.includes(l.text));

/** The shipped take's length in ticks (60 Hz), or NaN when the line has no take. */
function ticksOf(text: string): number {
  const v = own[voiceKey(text)];
  return v ? Math.ceil(v.duration * 60) : Number.NaN;
}

/** The fade-out at the end of every line take (40 ms), in whole ticks. */
const FADE_TICKS = Math.floor(0.04 * 60);

describe('sewers voice lines (Dutch, shipped)', () => {
  it("every voiced line has a shipped take in 'mission:sewers'; the heroes' lines have none", () => {
    expect(voiced.length).toBe(12);
    for (const { text } of voiced) expect(own[voiceKey(text)], text).toBeDefined();
    expect(HEROES).toEqual(['STAP IN, ZWAAN!', 'IK RUIK NAAR RIOOL.']);
    for (const t of HEROES) for (const g of Object.values(SAMPLE_MANIFEST)) expect(g.voice?.[voiceKey(t)], t).toBeUndefined();
  });

  it('the taxi left the ending (spec §0 row 56): its two takes are gone; the take files on disk match the manifest', () => {
    for (const key of ['instappen', 'de-meter-loopt']) expect(own[key], key).toBeUndefined();
    const files = readdirSync(join(process.cwd(), 'public/audio/sewers/voice')).sort();
    expect(files).toEqual(Object.values(own).flatMap((v) => v.files.map((f) => f.replace('sewers/voice/', ''))).sort());
  });

  it("Gusto's two card lines and the announcer's start line have a take in 'boot'", () => {
    for (const t of [...SEWERS_CARD.briefing, SEWERS_CARD.announce!]) expect(boot[voiceKey(t)], t).toBeDefined();
  });

  it('every take fits its bubble: the take plus the pause stays inside sewersSayTicks', () => {
    for (const { text } of voiced) expect(ticksOf(text) + SEWERS_SAY_PAUSE, text).toBeLessThanOrEqual(sewersSayTicks(text));
    // Most takes keep to the spec's pace (`sewersLineSeconds`); MIJN LIMO!! is a wail (1.5 s), inside its 120-tick bubble.
    const over = voiced.filter(({ text }) => own[voiceKey(text)].duration > sewersLineSeconds(text)).map((l) => l.text);
    expect(over).toEqual([SEWERS_VOICE.gerrit.limo]);
  });

  it("the sewer worker's first line is over before his second one starts (WORKER_GAG.second)", () => {
    // The second line may cut at most the take's 40 ms fade-out (tools/audio/process.ts).
    for (const first of [SEWERS_VOICE.worker.light, SEWERS_VOICE.worker.plugs]) expect(ticksOf(first) - FADE_TICKS, first).toBeLessThanOrEqual(WORKER_GAG.second);
  });
});
