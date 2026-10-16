/**
 * ROBO-HALSEMA's spoken lines (mission ams): one voice clip per speech bubble.
 *
 * Every line has its own file, named after its bubble text: `public/audio/mayor/<voiceKey>.mp3`
 * (e.g. `mayor/de-buren-hebben-geklaagd.mp3`). Until the final recordings exist, each file is a
 * placeholder: a short robot warble about as long as the line takes to read
 * (`npm run audio:mayor-placeholders` writes the missing ones and never overwrites a file).
 * To add a recording, replace the placeholder file with the real MP3 under the same name. Its
 * length comes from the decoded file; `duration` below is only the placeholder's length.
 *
 * Rules (docs/ORIGINALITY.md, exception for mission ams): the recordings must be original or
 * recorded with the speaker's consent. Never a cloned, sample-trained or imitated voice of the
 * real person the caricature is based on.
 *
 * The audio tool (`npm run audio:ship`) only manages public/audio/boot and public/audio/ams, so it
 * never touches these files. The clips register as voice samples of the 'mission:ams' group
 * (content/samples/index.ts) under the `voiceKey` of the bubble text; the boss plays them with
 * `AmsMayor.playVoice`, and the wordless robot chatter (`ams/mayor-babble`) stands in whenever a
 * clip is not loaded (headless, a failed fetch, VOICE VOLUME 0).
 */
import { voiceKey, type SampleVoice } from '../../../../engine/samples';

/** The folder of her clips, relative to public/audio/. */
export const MAYOR_VOICE_DIR = 'mayor';

/** One spoken line: the exact bubble text (`\n` = the bubble's second row) and its clip. */
export interface MayorLine {
  readonly text: string;
  /** The clip, relative to public/audio/: `mayor/<voiceKey(text)>.mp3`. */
  readonly file: string;
  /** Length of the placeholder clip in seconds (playback uses the decoded file's length). */
  readonly duration: number;
  /** Gain factor of the clip (default 1). */
  readonly vol?: number;
}

/** The clip file of a bubble text. */
export function mayorClipFile(text: string): string {
  return `${MAYOR_VOICE_DIR}/${voiceKey(text)}.mp3`;
}

/** Placeholder length: about as long as the line takes to say (0.7–2.8 s, rounded to 0.1 s). */
export function placeholderSeconds(text: string): number {
  const chars = text.replace(/[^A-Z0-9]/gi, '').length;
  return Math.round(Math.min(2.8, Math.max(0.7, 0.3 + chars * 0.07)) * 10) / 10;
}

/**
 * Gain of her clips (2.5× ≈ +8 dB). The clips are −15 LUFS like every voice line, but her robot
 * timbre drowned under the mission music (itself boosted 2×) and the gunfire (user feedback
 * 2026-10-16); the master compressor keeps the sum from clipping.
 */
export const MAYOR_VOICE_VOL = 2.5;

function line(this: any, text: string): MayorLine {
  return { text, file: mayorClipFile(text), duration: placeholderSeconds(text), vol: MAYOR_VOICE_VOL };
}

/** Every bubble of hers, by moment (GDD §10, docs/api/locals.md). */
export const MAYOR_LINES = {
  /** Intro, after she steps out of the Stopera. */
  complained: line('DE BUREN HEBBEN\nGEKLAAGD.'),
  /** Intro, the stamp goes up. */
  closed: line('FABEL FRIET IS VANAF\nNU GESLOTEN!'),
  /** Phase 1, after her first stamp slam. */
  noFries: line('FABEL FRIET WILLEN\nWE NIET!'),
  /** Phase 2 opens. */
  rules: line('REGELS ZIJN REGELS!'),
  /** Phase 2, after the first chain-whip pair: the first of two bubbles … */
  hotdog1: line('IK WORD HELEMAAL GEK\nVAN DIE HOTDOGKRAAM...'),
  /** … and the second one. */
  hotdog2: line('...OP MIJN\nMUSEUMPLEIN!'),
  /** Phase 3 opens. */
  fine: line('DIT KOST JE EEN\nFLINKE BOETE!'),
  /** The stamp arm breaks. */
  stamp: line('MIJN STEMPEL!'),
  /** The head breaks, the hair helmet flies off. */
  hair: line('MIJN HAAR, MIJN\nPRACHTIGE HAAR!'),
  /** Death. */
  goodbye: line('TOT ZIENS...'),
} as const satisfies Record<string, MayorLine>;

export type MayorLineId = keyof typeof MAYOR_LINES;

/** The voice samples of her lines, keyed like every other bubble line (`voiceKey(text)`). */
export function mayorVoiceSamples(): Record<string, SampleVoice> {
  const out: Record<string, SampleVoice> = {};
  for (const l of Object.values(MAYOR_LINES) as MayorLine[]) {
    const v: { files: string[]; duration: number; vol?: number } = { files: [l.file], duration: l.duration };
    if (l.vol !== undefined) v.vol = l.vol;
    out[voiceKey(l.text)] = v;
  }
  return out;
}
