/**
 * Songs of mission `ams`, THE FRYING DUTCHMAN (docs/design/amsterdam.md §4; GDD §12.2;
 * manifest entry 'music/ams'). Registers at import time. Every note was composed for
 * METAL SWAN 3 (docs/ORIGINALITY.md): no melody, bass line or arrangement is taken from any
 * existing tune — in particular no Dutch folk, schlager or street-organ song about Amsterdam.
 *
 * - `ams` — a street-organ (draaiorgel) waltz in 3/4, F major, 150 bpm, 3 rows per beat
 *   (9 rows per bar). The organ sings the tune with a bright piping rank an octave up, a
 *   glockenspiel answers in the gaps, the bass goes "oom" on 1 and the chords go "pah-pah" on
 *   2 and 3, a light drum and rim keep the carousel turning.
 *   intro 4 → A 16 → B 16 (B♭ major) → A′ 16 (glockenspiel thirds, a second organ voice) →
 *   loop to A (A + B + A′ = 57.6 s).
 * - `ams-boss` — ROBO-HALSEMA: D minor, 160 bpm, driving. A 16th-note saw bass ostinato, organ
 *   stabs in a 3+3+2 push, a bold pulse lead, snare rolls into every phrase.
 *   intro 4 → A 16 → B 16 (the "rules are rules" call) → C 8 (organ break, a rising build) →
 *   loop to A (A + B + C = 60 s).
 */
import { defineSong } from '../../../engine/audio';
import type { InstrumentDef, SongDef } from '../../../engine/music';
import { ACTION_LEAD, DRIVE_BASS, harmonize, KIT, measures, ORGAN, rep } from './index';

// ---------------------------------------------------------------------------------------------
// ams — the street-organ waltz (F major, 3/4, 3 rows per beat)
// ---------------------------------------------------------------------------------------------

/** Rows per 3/4 bar at 3 rows per beat. */
export const WALTZ_BAR = 9;

const waltz = (s: string): string => measures(s, WALTZ_BAR);

/** The piping rank of the organ: a thin, bright pulse an octave above the lead with a fast tremble. */
const PIPES: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.01, d: 0.12, s: 0.7, r: 0.08 },
  vol: 0.16,
  vibrato: { rate: 6.5, depth: 9, delay: 0.05 },
  filter: { type: 'lowpass', freq: 3600, q: 0.8 },
};

/** The glockenspiel: a short, bright FM bell. */
const GLOCK: InstrumentDef = {
  kind: 'fm',
  env: { a: 0.001, d: 0.45, s: 0, r: 0.2 },
  vol: 0.15,
  fm: { ratio: 3.5, index: 2.2, decay: 0.12 },
  oneShot: true,
};

/** The organ's accompaniment register: short reedy "pah" chords. */
const PAH: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.004, d: 0.1, s: 0.4, r: 0.05 },
  vol: 0.075,
  filter: { type: 'lowpass', freq: 1700, q: 0.8 },
};

/** The organ's bass pipes: a round, soft-edged "oom". */
const OOM: InstrumentDef = {
  kind: 'triangle',
  env: { a: 0.004, d: 0.25, s: 0.55, r: 0.06 },
  vol: 0.42,
};

/** Waltz harmony: [bass on 1, chord on 2 and 3]. */
const WCH: Readonly<Record<string, readonly [string, string]>> = {
  F: ['F2', 'A3+C4+F4'],
  Fc: ['C2', 'A3+C4+F4'],
  F7: ['F2', 'A3+Eb4+F4'],
  Dm: ['D2', 'A3+D4+F4'],
  Gm: ['G2', 'Bb3+D4+G4'],
  C7: ['C2', 'Bb3+C4+E4'],
  C7g: ['G1', 'Bb3+C4+E4'],
  A7: ['A1', 'G3+C#4+E4'],
  Bb: ['Bb1', 'Bb3+D4+F4'],
  Bbf: ['F2', 'Bb3+D4+F4'],
  Bbm: ['Bb1', 'Bb3+Db4+F4'],
  Eb: ['Eb2', 'Bb3+Eb4+G4'],
  Ebb: ['Bb1', 'Bb3+Eb4+G4'],
  F7c: ['C2', 'A3+C4+Eb4'],
  G7: ['G1', 'G3+B3+F4'],
  Cm: ['C2', 'C4+Eb4+G4'],
};

const oomOf = (chords: readonly string[]): string => waltz(chords.map((c) => `${WCH[c][0]}/3 ./6`).join(' | '));
const pahOf = (chords: readonly string[]): string => waltz(chords.map((c) => `./3 ${WCH[c][1]}/2 . ${WCH[c][1]}/2 .`).join(' | '));

const A_CHORDS = ['F', 'Dm', 'Gm', 'C7', 'F', 'A7', 'Dm', 'C7g', 'F', 'F7', 'Bb', 'Bbm', 'Fc', 'C7', 'F', 'C7g'];
const B_CHORDS = ['Bb', 'Bbf', 'Eb', 'Ebb', 'F7', 'F7c', 'Bb', 'G7', 'Cm', 'F7', 'Bb', 'Gm', 'Eb', 'F7', 'Bb', 'C7'];
const A2_CHORDS = ['F', 'Dm', 'Gm', 'C7', 'F', 'A7', 'Dm', 'C7g', 'F', 'F7', 'Bb', 'Bbm', 'Fc', 'C7', 'F', 'F'];
const INTRO_CHORDS = ['F', 'Fc', 'C7', 'C7g'];

/** The first 12 bars of the tune: a short-long lift to the top, a turn down, a minor-iv sigh. */
const TUNE_HEAD =
  'A4/2 C5 F5/6 | E5/2 F5 D5/3 A4/3 | Bb4/2 D5 G5/6 | F5/2 G5 E5/3 C5/3 |' +
  'A5/6 G5/2 F5 | E5/3 C#5/3 E5/3 | F5/2 E5 D5/2 C5 A4/3 | G4/3 Bb4/3 C5/3 |' +
  'A4/2 C5 F5/6 | Eb5/2 F5 C5/3 A4/3 | D5/2 F5 Bb5/6 | Db5/2 F5 Bb5/3 Ab5/3';

/** A: the tune, ending with a turn up into B♭. */
const AMS_A = waltz(`${TUNE_HEAD} | A5/3 G5/2 F5 C5/3 | Bb4/2 C5 E5/3 G5/3 | F5/9 | ./3 C5/2 D5 E5/3`);

/** B (B♭ major): a broader singing line, a climb through E♭ and Cm, a turn back to F. */
const AMS_B = waltz(
  'D5/6 C5/2 Bb4 | F5/6 D5/3 | G5/3 F5/3 Eb5/3 | G5/2 F5 Eb5/2 D5 C5/3 |' +
    'C5/3 Eb5/3 A5/3 | A5/2 Bb5 A5/3 F5/3 | Bb5/6 F5/3 | F5/2 D5 B4/3 G4/3 |' +
    'G5/6 Eb5/3 | F5/2 Eb5 C5/3 A4/3 | D5/3 F5/3 Bb5/3 | Bb5/2 A5 G5/3 D5/3 |' +
    'Eb5/3 G5/3 C6/3 | C6/2 Bb5 A5/2 G5 F5/3 | D5/2 Eb5 F5/3 Bb4/3 | Bb5/2 G5 E5/3 C5/3',
);

/** A′: the tune with a grander ending that climbs to the top C and hands back to A. */
const AMS_A2 = waltz(`${TUNE_HEAD} | C6/3 A5/2 F5 C5/3 | D5/2 E5 G5/3 Bb5/3 | A5/3 F5/3 C5/3 | F5/6 F4/2 G4`);

const AMS_INTRO = waltz('./9 | ./9 | ./9 | ./6 F4/2 G4');

/** Glockenspiel answers in the gaps of the tune. */
const GLOCK_A = waltz(
  './3 C6_3 A5_3 | ./9 | ./3 D6_3 Bb5_3 | ./9 | ./9 | ./9 | ./9 | E6_3 D6_3 C6_3 |' +
    './3 C6_3 A5_3 | ./9 | ./3 F6_3 D6_3 | ./9 | ./9 | ./9 | ./3 A5_3 C6_3 | F6_3 ./6',
);
const GLOCK_B = waltz(
  './3 F6_3 D6_3 | ./6 Bb5_3 | ./9 | ./9 | ./9 | ./9 | ./3 D6_3 F6_3 | ./9 |' +
    './3 C6_3 G5_3 | ./9 | ./9 | ./9 | ./9 | ./9 | ./3 F6_3 D6_3 | ./9',
);
/** A′: the glockenspiel doubles the tune a third above. */
const GLOCK_A2 = harmonize(AMS_A2, 5, 2);
const GLOCK_INTRO = waltz('F5_3 A5_3 C6_3 | F6_3 C6_3 A5_3 | E5_3 G5_3 Bb5_3 | C6_3 ./6');

/** Light drum: kick on 1, rim on 2 and 3; a small pickup every 4th bar and a fill at 16. */
const DRUM = 'k . . r . . r . .';
const DRUM_UP = 'k . . r . . r . r';
const DRUM_FILL = 'k . . s . s s s S';
const DRUM_16 = waltz([...rep([DRUM, DRUM, DRUM, DRUM_UP].join(' | '), 3), DRUM, DRUM, DRUM_UP, DRUM_FILL].join(' | '));
const DRUM_INTRO = waltz(['k . . . . . . . .', 'k . . . . . . . .', 'k . . r . . r . .', 'k . . s . s s s S'].join(' | '));

const AMS: SongDef = {
  bpm: 150,
  rowsPerBeat: 3,
  // Mix level: matched to `m1` by the audio report (≈ −20 dB RMS, like `m1`).
  vol: 1.6,
  order: ['intro', 'A', 'B', 'A2'],
  loop: 1,
  channels: [
    // The organ sings the tune.
    {
      inst: ORGAN,
      vol: 1.5,
      pan: 0.05,
      patterns: { intro: AMS_INTRO, A: AMS_A, B: AMS_B, A2: AMS_A2 },
    },
    // The piping rank an octave up (quieter; it is colour, not a second tune).
    {
      inst: PIPES,
      vol: 0.7,
      pan: 0.2,
      transpose: 12,
      patterns: { intro: AMS_INTRO, A: AMS_A, B: AMS_B, A2: AMS_A2 },
    },
    // A′: a second organ voice a third below.
    { inst: ORGAN, vol: 0.6, pan: -0.15, patterns: { A2: harmonize(AMS_A2, 5, -2) } },
    // Glockenspiel.
    { inst: GLOCK, vol: 0.9, pan: -0.3, patterns: { intro: GLOCK_INTRO, A: GLOCK_A, B: GLOCK_B, A2: GLOCK_A2 } },
    // Oom on 1 …
    { inst: OOM, vol: 0.85, patterns: { intro: oomOf(INTRO_CHORDS), A: oomOf(A_CHORDS), B: oomOf(B_CHORDS), A2: oomOf(A2_CHORDS) } },
    // … pah-pah on 2 and 3.
    { inst: PAH, vol: 1, pan: -0.2, patterns: { intro: pahOf(INTRO_CHORDS), A: pahOf(A_CHORDS), B: pahOf(B_CHORDS), A2: pahOf(A2_CHORDS) } },
    { inst: 'drums', vol: 0.45, kit: KIT, patterns: { intro: DRUM_INTRO, A: DRUM_16, B: DRUM_16, A2: DRUM_16 } },
  ],
};

// ---------------------------------------------------------------------------------------------
// ams-boss — ROBO-HALSEMA (D minor, 160 bpm, 4/4)
// ---------------------------------------------------------------------------------------------

/** A short, punchy organ stab (the same three detuned saws as ORGAN, clipped). */
const ORGAN_STAB: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.006, d: 0.14, s: 0.45, r: 0.08 },
  vol: 0.16,
  detune: 7,
  filter: { type: 'lowpass', freq: 2600, q: 0.9 },
};

/** Boss harmony: [bass root, octave, fifth, flat-seventh-ish passing note, stab chord]. */
const BCH: Readonly<Record<string, readonly [string, string, string, string, string]>> = {
  Dm: ['D2', 'D3', 'A2', 'C3', 'D4+F4+A4'],
  Bb: ['Bb1', 'Bb2', 'F2', 'Ab2', 'D4+F4+Bb4'],
  Gm: ['G1', 'G2', 'D2', 'F2', 'D4+G4+Bb4'],
  A: ['A1', 'A2', 'E2', 'G2', 'C#4+E4+A4'],
  C: ['C2', 'C3', 'G2', 'Bb2', 'C4+E4+G4'],
  F: ['F1', 'F2', 'C2', 'Eb2', 'C4+F4+A4'],
  Eb: ['Eb2', 'Eb3', 'Bb2', 'Db3', 'Eb4+G4+Bb4'],
};

/** One bar of the 16th-note ostinato: root pumping, octave jumps, the fifth and the seventh. */
function ostinato(c: string): string {
  const [r, o, f, s] = BCH[c];
  return [r, r, o, r, '.', r, f, r, r, o, r, f, o, r, s, f].join(' ');
}

/** Half-time pedal for the break: one root per half bar. */
function pedal(c: string): string {
  const [r, o] = BCH[c];
  return measures(`${r}/6 ./2 ${o}/4 ./4`);
}

/** Organ stabs in a 3+3+2 push: on 1, the "and" of 2, and 4. */
function stabs(c: string): string {
  const ch = BCH[c][4];
  return measures(`${ch}/2 ./4 ${ch}/2 ./4 ${ch}/3 .`);
}

/** Held organ chords for the break. */
function heldChord(c: string): string {
  return measures(`${BCH[c][4]}/14 ./2`);
}

const BA = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'C', 'Dm', 'A', 'Bb', 'C', 'A', 'A'];
const BB = ['Gm', 'Gm', 'Dm', 'Dm', 'Eb', 'Eb', 'A', 'A', 'Gm', 'C', 'F', 'Bb', 'Eb', 'Gm', 'A', 'A'];
const BC = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'];

const BOSS_LEAD_A = measures(
  'D5/6 F5/2 A5/4 G5/2 F5/2 | Bb5/8 A5/2 G5/2 F5/4 | G5/4 D5/4 Bb4/2 C5/2 D5/4 | C#5/8 E5/4 A4/4 |' +
    'D5/6 F5/2 A5/4 D6/4 | C6/2 Bb5/2 A5/4 F5/4 D5/4 | E5/4 G5/4 Bb5/4 A5/2 G5/2 | A5/12 ./4 |' +
    'F5/6 G5/2 A5/4 Bb5/4 | C6/6 Bb5/2 A5/4 G5/4 | A5/6 F5/2 D5/8 | E5/4 F5/4 G5/4 C#5/4 |' +
    'D5/4 F5/4 Bb5/8 | C6/4 E5/4 G5/8 | A5/4 G5/2 F5/2 E5/4 C#5/4 | E5/8 ./4 A4/2 C#5/2',
);

/** B: "rules are rules" — clipped repeated notes, then a long answer. */
const BOSS_LEAD_B = measures(
  'G5_2 G5_2 G5/4 Bb5/4 A5/4 | G5/4 F5/4 D5/8 | F5_2 F5_2 F5/4 A5/4 G5/4 | F5/4 E5/4 D5/8 |' +
    'Eb5_2 Eb5_2 Eb5/4 G5/4 Bb5/4 | C6/8 Bb5/4 G5/4 | A5/4 C#6/4 E6/8 | E6/4 D6/2 C#6/2 Bb5/2 A5/2 G5/2 E5/2 |' +
    'D5/6 G5/2 Bb5/8 | C6/6 Bb5/2 E5/8 | F5/6 A5/2 C6/8 | D6/6 C6/2 Bb5/8 |' +
    'G5/4 Bb5/4 Eb6/8 | D6/4 Bb5/4 G5/4 D5/4 | C#5/4 E5/4 G5/4 Bb5/4 | A5/8 ./8',
);

/** C: silence, then a rising build back into A. */
const BOSS_LEAD_C = measures('./16 | ./16 | ./16 | ./16 | ./16 | ./16 | A4/4 C#5/4 E5/4 G5/4 | A5/4 Bb5/4 C#6/4 E6/4');

const BD = 'k . h . s . h . k . k h s . h h';
const BD_ROLL = 'k . h . s . h . s:5 s:5 s:6 s:6 s:7 s:8 S S';
const BD_CRASH = 'k+c . h . s . h . k . k h s . h h';
const BD_A = measures([BD_CRASH, BD, BD, BD, BD, BD, BD, BD_ROLL, BD_CRASH, BD, BD, BD, BD, BD, BD, BD_ROLL].join(' | '));
const BD_BREAK = 'm . . . . . . . m . . . . . . .';
const BD_C = measures([BD_BREAK, BD_BREAK, BD_BREAK, BD_BREAK, BD_BREAK, BD_BREAK, 's . s . s . s . s s s s s s s s', 's:5 s:5 s:6 s:6 s:6 s:7 s:7 s:7 s:8 s:8 s:8 s:9 S S S S'].join(' | '));
const BD_INTRO = measures(['k+c . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', 's . s . s . s . s . s . s . s .', 's:5 s:5 s:6 s:6 s:6 s:7 s:7 s:7 s:8 s:8 s:8 s:9 S S S S'].join(' | '));

const AMS_BOSS: SongDef = {
  bpm: 160,
  rowsPerBeat: 4,
  // Mix level: matched to `boss` by the audio report.
  vol: 1.04,
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    { inst: ACTION_LEAD, vol: 0.9, pan: 0.1, patterns: { A: BOSS_LEAD_A, B: BOSS_LEAD_B, C: BOSS_LEAD_C } },
    {
      inst: ORGAN_STAB,
      vol: 1,
      pan: -0.2,
      patterns: {
        intro: measures(`${BCH.Dm[4]}/16 | ${BCH.Dm[4]}/14 ./2 | ${BCH.Bb[4]}/16 | ${BCH.A[4]}/14 ./2`),
        A: BA.map(stabs).join(' | '),
        B: BB.map(stabs).join(' | '),
        C: BC.map(heldChord).join(' | '),
      },
    },
    {
      inst: DRIVE_BASS,
      vol: 1,
      patterns: {
        intro: measures(`./16 | ./16 | ${ostinato('Dm')} | ${ostinato('A')}`),
        A: measures(BA.map(ostinato).join(' | ')),
        B: measures(BB.map(ostinato).join(' | ')),
        C: [...BC.slice(0, 6).map(pedal), measures(ostinato('A')), measures(ostinato('A'))].join(' | '),
      },
    },
    { inst: 'drums', vol: 0.8, kit: KIT, patterns: { intro: BD_INTRO, A: BD_A, B: BD_A, C: BD_C } },
  ],
};

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** Every song of this module by id (tests parse them). Not part of MISSION_SONGS. */
export const AMS_SONGS: Readonly<Record<string, SongDef>> = {
  ams: AMS,
  'ams-boss': AMS_BOSS,
};

for (const [id, song] of Object.entries(AMS_SONGS)) defineSong(id, song);
