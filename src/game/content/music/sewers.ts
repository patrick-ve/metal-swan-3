/**
 * Songs of mission `sewers` (level 2, RATTENJONG MET DE RATTENITEMS; docs/design/sewers.md §7): the
 * synth fallbacks of the four ids of missions/sewers/ids.ts `SEWERS_SONG`. The ElevenLabs takes of
 * the sample group 'mission:sewers' replace them when loaded (after the user's OK on the credits).
 * Registers at import time (content manifest id 'music/sewers', LAZY with the sewers chunk:
 * content/index.ts `isSewersContent`; it imports only the engine). Every note was composed for METAL
 * SWAN 3 (docs/ORIGINALITY.md): no melody, bass line or arrangement is taken from an existing tune.
 *
 * P0 start values: short, plain loops so every section has its own music; the audio wave may write
 * fuller fallbacks.
 *
 * - `sewers-street` — a, b: slow sleazy synth-funk, C minor, 90 bpm. A plucky saw bass, off-beat
 *   chord stabs, a lazy lead, a dry funk beat. intro 1 → A 8 (Cm Cm Fm G twice) → B 8 (Ab Ab Fm G,
 *   the lead an octave up) → loop to A.
 * - `sewers-gerrit` — the mini-boss: the same groove pushed to 118 bpm, E minor, a brighter lead and
 *   a busier beat; a short funky loop (A 8 → B 8).
 * - `sewers-sewer` — c, d: dark drones, drips, a low pulse; C minor, 70 bpm. A held pad, a sub pulse
 *   on 1 and 3, a far kick, a bell drip now and then (A 8 → loop).
 * - `sewers-boss` — e (its outro plays on sewers-end): heavy and grimy, C minor, 140 bpm. A 16th-note
 *   saw ostinato, power stabs, a pounding beat (intro 2 → A 8 → B 8 → loop to A).
 */
import { defineSong } from '../../../engine/audio';
import { patternRows, type InstrumentDef, type SongDef } from '../../../engine/music';

/** Rows per 4/4 bar (4 rows per beat). */
export const SEWERS_BAR = 16;

/** Bars joined with '|', each checked for exactly 16 rows. */
function bars(...list: string[]): string {
  list.forEach((b, i) => {
    const n = patternRows(b).length;
    if (n !== SEWERS_BAR) throw new Error(`music/sewers: bar ${i} has ${n} rows, expected ${SEWERS_BAR}: "${b}"`);
  });
  return list.join(' | ');
}

const REST = '. . . . . . . . . . . . . . . .';

// ---------------------------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------------------------

/** Plucky funk bass: the filter opens on every note. */
const FUNK_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.12, s: 0.4, r: 0.05 }, vol: 0.28, filter: { type: 'lowpass', freq: 700, q: 2.4, env: 3 } };
/** Short off-beat chord stabs. */
const STAB: InstrumentDef = { kind: 'pulse', duty: 0.25, env: { a: 0.004, d: 0.1, s: 0.3, r: 0.06 }, vol: 0.09, filter: { type: 'lowpass', freq: 1900, q: 1 } };
/** A lazy, slightly nasal lead with a slow vibrato. */
const SLEAZE_LEAD: InstrumentDef = { kind: 'saw', env: { a: 0.02, d: 0.3, s: 0.7, r: 0.15 }, vol: 0.2, detune: 8, vibrato: { rate: 4.5, depth: 22, delay: 0.25 }, filter: { type: 'lowpass', freq: 2400, q: 1.4, env: 1.5 } };
/** The sewer's drone pad. */
const DRONE: InstrumentDef = { kind: 'pad', env: { a: 0.8, d: 1, s: 0.8, r: 1.2 }, vol: 0.13, detune: 18, filter: { type: 'lowpass', freq: 700, q: 0.8 } };
/** A deep sub pulse. */
const SUB: InstrumentDef = { kind: 'sine', env: { a: 0.01, d: 0.4, s: 0.5, r: 0.2 }, vol: 0.36 };
/** A drop of water: a short FM bell. */
const DRIP: InstrumentDef = { kind: 'fm', env: { a: 0.001, d: 0.5, s: 0, r: 0.2 }, vol: 0.12, fm: { ratio: 2.4, index: 3, decay: 0.08 }, oneShot: true };
/** The boss ostinato: a grimy saw. */
const GRIME_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.08, s: 0.55, r: 0.03 }, vol: 0.26, detune: 12, filter: { type: 'lowpass', freq: 1200, q: 2.6, env: 2.4 } };
/** Power stabs. */
const POWER: InstrumentDef = { kind: 'saw', env: { a: 0.004, d: 0.18, s: 0.4, r: 0.08 }, vol: 0.15, detune: 14, filter: { type: 'lowpass', freq: 2600, q: 1.2, env: 1.6 } };

// ---------------------------------------------------------------------------------------------
// The street groove (sewers-street, sewers-gerrit)
// ---------------------------------------------------------------------------------------------

/** One bar of bass per chord. */
const BASS: Readonly<Record<string, string>> = {
  Cm: 'C2 . . C3 . . Bb1 . C2 . . . G1 . Bb1 .',
  Fm: 'F1 . . F2 . . Eb2 . F1 . . . C2 . Eb2 .',
  G: 'G1 . . G2 . . F2 . G1 . . . D2 . F2 .',
  Ab: 'Ab1 . . Ab2 . . Gb2 . Ab1 . . . Eb2 . Gb2 .',
};
/** The stab chord of each chord. */
const CHORD: Readonly<Record<string, string>> = { Cm: 'C4+Eb4+G4', Fm: 'C4+F4+Ab4', G: 'B3+D4+G4', Ab: 'C4+Eb4+Ab4' };
const stab = (c: string): string => `. . . . ${CHORD[c]} - . . . . . . ${CHORD[c]} . . .`;

const A_CHORDS = ['Cm', 'Cm', 'Fm', 'G', 'Cm', 'Cm', 'Fm', 'G'];
const B_CHORDS = ['Ab', 'Ab', 'Fm', 'G', 'Ab', 'Ab', 'Fm', 'G'];

const LEAD_A = [
  'G4 - - - Bb4 - C5 - . . Eb5 - D5 - C5 -',
  'Bb4 - - - - - - - . . G4 - Bb4 - . .',
  'Ab4 - - - C5 - Eb5 - F5 - - - Eb5 - C5 -',
  'D5 - - - - - - - B4 - - - G4 - . .',
];
const LEAD_B = [
  'Eb5 - - - C5 - Eb5 - . . Ab5 - G5 - Eb5 -',
  'C5 - - - - - - - . . Ab4 - C5 - . .',
  'F5 - - - Ab5 - G5 - F5 - - - Eb5 - D5 -',
  'B4 - - - - - - - D5 - - - G5 - . .',
];
const FUNK_BEAT = 'k . h . s . h k . k h . s . h .';
const FUNK_BEAT_BUSY = 'k . h k s . h k . k h . s . h s';

function streetSong(bpm: number, transpose: number, beat: string): SongDef {
  return {
    bpm,
    order: ['intro', 'A', 'B'],
    loop: 1,
    channels: [
      { inst: SLEAZE_LEAD, vol: 0.9, pan: 0.15, transpose, patterns: { A: bars(...LEAD_A, ...LEAD_A), B: bars(...LEAD_B, ...LEAD_B) } },
      { inst: STAB, vol: 1, pan: -0.2, transpose, patterns: { A: bars(...A_CHORDS.map(stab)), B: bars(...B_CHORDS.map(stab)) } },
      { inst: FUNK_BASS, vol: 1, transpose, patterns: { intro: bars(BASS.Cm), A: bars(...A_CHORDS.map((c) => BASS[c])), B: bars(...B_CHORDS.map((c) => BASS[c])) } },
      { inst: 'drums', vol: 0.75, patterns: { intro: bars(FUNK_BEAT), A: bars(...Array.from({ length: 8 }, () => beat)), B: bars(...Array.from({ length: 8 }, () => beat)) } },
    ],
  };
}

export const SEWERS_STREET: SongDef = streetSong(90, 0, FUNK_BEAT);
export const SEWERS_GERRIT: SongDef = { ...streetSong(118, 4, FUNK_BEAT_BUSY), order: ['A', 'B'], loop: 0 };

// ---------------------------------------------------------------------------------------------
// The sewer (sewers-sewer)
// ---------------------------------------------------------------------------------------------

const DRONE_BAR = (n: string): string => `${n} - - - - - - - - - - - - - - -`;
const PULSE_BAR = (n: string): string => `${n} - . . . . . . ${n} - . . . . . .`;
const DRIP_A = ['G5 . . . . . . . . . . . . . . .', REST, '. . . . . . . . . . Eb6 . . . . .', REST, REST, '. . . . . . C6 . . . . . . . . .', REST, REST];

export const SEWERS_SEWER: SongDef = {
  bpm: 70,
  order: ['A'],
  loop: 0,
  channels: [
    { inst: DRONE, vol: 1, patterns: { A: bars(...['C3+G3', 'C3+G3', 'Ab2+Eb3', 'G2+D3', 'C3+G3', 'C3+Ab3', 'Ab2+Eb3', 'G2+D3'].map(DRONE_BAR)) } },
    { inst: SUB, vol: 1, patterns: { A: bars(...['C2', 'C2', 'Ab1', 'G1', 'C2', 'C2', 'Ab1', 'G1'].map(PULSE_BAR)) } },
    { inst: DRIP, vol: 1, pan: 0.3, patterns: { A: bars(...DRIP_A) } },
    { inst: 'drums', vol: 0.5, patterns: { A: bars(...Array.from({ length: 8 }, () => 'k . . . . . . . . . . . . . . .')) } },
  ],
};

// ---------------------------------------------------------------------------------------------
// The boss (sewers-boss)
// ---------------------------------------------------------------------------------------------

const OSTINATO: Readonly<Record<string, string>> = {
  C: 'C2 C2 C3 C2 Eb2 C2 C3 C2 F2 C2 C3 C2 Gb2 C2 C3 C2',
  Ab: 'Ab1 Ab1 Ab2 Ab1 C2 Ab1 Ab2 Ab1 Eb2 Ab1 Ab2 Ab1 D2 Ab1 Ab2 Ab1',
  G: 'G1 G1 G2 G1 Bb1 G1 G2 G1 D2 G1 G2 G1 Db2 G1 G2 G1',
};
const POWER_CHORD: Readonly<Record<string, string>> = { C: 'C3+G3+C4', Ab: 'Ab2+Eb3+Ab3', G: 'G2+D3+G3' };
const power = (c: string): string => `${POWER_CHORD[c]}! - - . . . ${POWER_CHORD[c]} - . . . . ${POWER_CHORD[c]} - - -`;
const BOSS_A = ['C', 'C', 'Ab', 'G', 'C', 'C', 'Ab', 'G'];
const BOSS_B = ['Ab', 'Ab', 'C', 'C', 'Ab', 'G', 'C', 'G'];
const BOSS_BEAT = 'k . s . k k s . k . s . k k s s';

export const SEWERS_BOSS: SongDef = {
  bpm: 140,
  order: ['intro', 'A', 'B'],
  loop: 1,
  channels: [
    { inst: POWER, vol: 1, pan: -0.1, patterns: { A: bars(...BOSS_A.map(power)), B: bars(...BOSS_B.map(power)) } },
    { inst: GRIME_BASS, vol: 1, patterns: { intro: bars(OSTINATO.C, OSTINATO.G), A: bars(...BOSS_A.map((c) => OSTINATO[c])), B: bars(...BOSS_B.map((c) => OSTINATO[c])) } },
    { inst: 'drums', vol: 0.8, patterns: { intro: bars('k . . . k . . . k . . . s s s s', 'k . . . k . . . s s s s s s s s'), A: bars(...Array.from({ length: 8 }, () => BOSS_BEAT)), B: bars(...Array.from({ length: 8 }, () => BOSS_BEAT)) } },
  ],
};

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** Every song of this module by id (ids.ts `SEWERS_SONG`; tests parse them). */
export const SEWERS_SONGS: Readonly<Record<string, SongDef>> = {
  'sewers-street': SEWERS_STREET,
  'sewers-gerrit': SEWERS_GERRIT,
  'sewers-sewer': SEWERS_SEWER,
  'sewers-boss': SEWERS_BOSS,
};

for (const [id, song] of Object.entries(SEWERS_SONGS)) defineSong(id, song);
