/**
 * ROBO-HALSEMA's voice clips (bosses/ams/voice.ts): the line table, the placeholder file, the
 * registration in the 'mission:ams' sample group, and `playVoice` — her clip when one is loaded,
 * the wordless robot chatter (`ams/mayor-babble`) otherwise.
 */
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { getSampleGroup, voiceKey, type SayOpts } from '../../src/engine/samples';
import '../../src/game/content/locals/index';
import '../../src/game/content/samples/index';
import { AmsMayor, MAYOR } from '../../src/game/content/bosses/ams/index';
import { MAYOR_LINES, mayorClipFile, mayorVoiceSamples, placeholderSeconds, type MayorLine } from '../../src/game/content/bosses/ams/voice';
import { FLOOR, TestWorld } from './helpers';

const PUBLIC_AUDIO = new URL('../../public/audio/', import.meta.url);
const LINES = Object.values(MAYOR_LINES) as MayorLine[];

/** NullAudio plus a voice bank: `voiced` texts count as loaded clips. */
class VoiceAudio extends NullAudio {
  readonly said: { text: string; speaker?: string; o?: SayOpts }[] = [];
  private readonly voiced: (text: string) => boolean;
  constructor(voiced: (text: string) => boolean) {
    super();
    this.voiced = voiced;
  }
  hasVoice(text: string): boolean {
    return this.voiced(text);
  }
  say(text: string, speaker?: string, o?: SayOpts): void {
    this.said.push({ text, speaker, o });
  }
}

function arena(audio?: NullAudio): { tw: TestWorld; boss: AmsMayor; log: string[] } {
  const tw = new TestWorld({ width: 1200, god: true, playerX: 420 });
  if (audio) tw.world.audio = audio;
  const boss = tw.spawn('ams-mayor', 900, {}, FLOOR) as AmsMayor;
  return { tw, boss, log: (tw.world.audio as NullAudio).log };
}

/** Run the intro up to just after her first line. */
function firstLine(tw: TestWorld): void {
  tw.run(MAYOR.intro.dim + MAYOR.intro.walk + 6);
}

describe('ROBO-HALSEMA voice clips', () => {
  it('every line fits a bubble and points at a file that exists', () => {
    expect(LINES.length).toBe(10);
    for (const l of LINES) {
      const rows = l.text.split('\n');
      expect(rows.length, l.text).toBeLessThanOrEqual(2);
      for (const r of rows) expect(r.length, l.text).toBeLessThanOrEqual(24);
      expect(l.file, l.text).toMatch(/^mayor\/[a-z0-9._-]+\.mp3$/);
      const url = new URL(l.file, PUBLIC_AUDIO);
      expect(existsSync(url), `missing public/audio/${l.file}`).toBe(true);
      expect(statSync(url).size).toBeGreaterThan(0);
      expect(l.duration, l.text).toBeGreaterThan(0);
    }
  });

  it('every line has its own file, named after its bubble text', () => {
    expect(MAYOR_LINES.complained.file).toBe('mayor/de-buren-hebben-geklaagd.mp3');
    expect(MAYOR_LINES.hotdog2.file).toBe('mayor/op-mijn-museumplein.mp3');
    for (const l of LINES) expect(l.file, l.text).toBe(mayorClipFile(l.text));
    expect(new Set(LINES.map((l) => l.file)).size).toBe(LINES.length);
  });

  it('placeholder lengths follow the line length (0.7–2.8 s)', () => {
    expect(placeholderSeconds('TOT ZIENS...')).toBeLessThan(placeholderSeconds('IK WORD HELEMAAL GEK\nVAN DIE HOTDOGKRAAM...'));
    for (const l of LINES) {
      expect(l.duration, l.text).toBeGreaterThanOrEqual(0.7);
      expect(l.duration, l.text).toBeLessThanOrEqual(2.8);
    }
  });

  it('registers one voice sample per line in the mission:ams group, keyed by the bubble text', () => {
    const samples = mayorVoiceSamples();
    expect(Object.keys(samples).length).toBe(LINES.length);
    const group = getSampleGroup('mission:ams');
    for (const l of LINES) {
      const key = voiceKey(l.text);
      expect(samples[key]?.files, l.text).toEqual([l.file]);
      expect(group?.voice?.[key]?.files, l.text).toEqual([l.file]);
    }
  });

  it('headless (no clips): the robot chatter plays under her line and stops after it', () => {
    const { tw, log } = arena();
    firstLine(tw);
    expect(log).toContain('loop:mayor-babble:ams/mayor-babble');
    tw.run(120);
    expect(log).toContain('stopLoop:mayor-babble');
  });

  it('with a loaded clip: playVoice speaks the line as the mayor and plays no chatter', () => {
    const audio = new VoiceAudio(() => true);
    const { tw, log } = arena(audio);
    firstLine(tw);
    expect(audio.said[0]).toEqual({ text: MAYOR_LINES.complained.text, speaker: 'mayor', o: { important: true } });
    expect(log.some((e) => e.startsWith('loop:mayor-babble'))).toBe(false);
  });

  it('a missing clip for one line falls back to the chatter for that line only', () => {
    const audio = new VoiceAudio((t) => t !== MAYOR_LINES.complained.text);
    const { tw, log } = arena(audio);
    firstLine(tw);
    expect(audio.said.length).toBe(0);
    expect(log).toContain('loop:mayor-babble:ams/mayor-babble');
  });
});
