/**
 * Every spoken string of the first-person mode (docs/design/fps.md §7.4, §9.3), verbatim. Pure
 * data: the actors pick their alert and death lines here, the boss (group floors) its taunts.
 * The lines are original; none is a line of the reference game or a quote of a real person.
 * Voice samples are found by `voiceKey(text)` (samples.ts), so the texts must stay exactly as the
 * audio spec (`tools/audio/spec.ts`) has them; `tests/tools/audio-spec.test.ts` checks it.
 */

/** A speaker of `audio.say` (the voice ids of tools/audio/spec.ts). */
export type FpsSpeaker = 'guard' | 'officer' | 'ss' | 'mecha' | 'mechahitler';

/** One spoken line: the German / Dutch text and the English meaning (a subtitle when wanted). */
export interface FpsLine {
  readonly speaker: FpsSpeaker;
  readonly text: string;
  readonly meaning: string;
}

function line(speaker: FpsSpeaker, text: string, meaning: string): FpsLine {
  return { speaker, text, meaning };
}

/** Alert shouts per enemy type (spec §9.3; dogs bark instead). */
export const ALERT_LINES: Readonly<Record<'guard' | 'officer' | 'ss', readonly FpsLine[]>> = {
  guard: [line('guard', 'DA DRÜBEN!', 'OVER THERE!'), line('guard', 'EINDRINGLING!', 'INTRUDER!')],
  officer: [line('officer', 'ALLE MANN AUF POSTEN!', 'ALL HANDS TO YOUR POSTS!')],
  ss: [line('ss', 'FEUER FREI!', 'OPEN FIRE!')],
};

/** Death lines per enemy type (spec §9.3). */
export const DEATH_LINES: Readonly<Record<'guard' | 'officer' | 'ss', readonly FpsLine[]>> = {
  guard: [line('guard', 'MEINE BRILLE...!', 'MY GLASSES!'), line('guard', 'NICHT SCHON WIEDER...', 'NOT AGAIN...')],
  officer: [line('officer', 'MEIN SCHÖNER HUT...!', 'MY LOVELY HAT!')],
  ss: [line('ss', 'DAS STEHT NICHT IM HANDBUCH...!', 'THAT IS NOT IN THE MANUAL!')],
};

/**
 * The boss taunts 1–6 (spec §7.4), index 0 = taunt 1. Taunts 1–3 are the suit's Dutch lines
 * (speaker `mecha`, the user's own lines; the subtitle is the Dutch text itself, `\n` splits it
 * into two rows). Taunts 4–6 are MechaHitler's German lines with an English subtitle.
 */
export const BOSS_TAUNTS: readonly FpsLine[] = [
  line('mecha', 'IK BEN MECHA HOFMANS!', 'IK BEN MECHA HOFMANS!'),
  line('mecha', 'HET MUSJE, HET PRACHTIGE MUSJE...\nRED MIJ!', 'HET MUSJE, HET PRACHTIGE MUSJE...\nRED MIJ!'),
  line('mecha', 'PYRAMUS EN THISBE...\nLET OP DE ACCUSATIVUS!', 'PYRAMUS EN THISBE...\nLET OP DE ACCUSATIVUS!'),
  line('mechahitler', 'MEIN SCHÖNER ANZUG! DAS ZAHLT IHR MIR!', 'MY BEAUTIFUL SUIT! YOU WILL PAY FOR THIS!'),
  line('mechahitler', 'DAS IST NICHT FAIR! ICH HATTE VORTRITT!', 'THIS IS NOT FAIR! I HAD RIGHT OF WAY!'),
  line('mechahitler', 'DAS... STAND NICHT... IM PLAN...', 'THAT... WAS NOT... IN THE PLAN...'),
];

/** Every line of the mode (tools, tests). */
export const ALL_FPS_LINES: readonly FpsLine[] = [
  ...ALERT_LINES.guard,
  ...ALERT_LINES.officer,
  ...ALERT_LINES.ss,
  ...DEATH_LINES.guard,
  ...DEATH_LINES.officer,
  ...DEATH_LINES.ss,
  ...BOSS_TAUNTS,
];
