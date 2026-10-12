/**
 * Songs (GDD §12.2, §15.8): `select`, `briefing`, `m1`, `m2`, `m3`, `m4`, `anthem`, `high-score`.
 * Registered with defineSong at import time (manifest entry 'music/missions').
 *
 * Every melody, bass line and drum part here was composed for METAL SWAN 3
 * (docs/ORIGINALITY.md); the anthem is the Legion's own invented anthem.
 *
 * - `select` — A major, 128 bpm, bouncy: eager staccato 8ths over a walking bass and hats, then
 *   the Cygnet hook (bars 9–12) answered by running 16ths in the bass (the paddling).
 *   One 16-bar loop (30 s).
 * - `briefing` — G mixolydian, 96 bpm: a band-passed "radio" pulse that chatters in repeated
 *   notes, a triangle bass, brushes. One 8-bar loop (20 s).
 * - `m1` — D major in 6/8 (3 rows per beat), 132 bpm: a sunny regatta march; the harmony
 *   follows the lead in thirds, the bass goes "oom" on 1 and 4, the bell decorates the phrase
 *   ends. intro 4 → A 16 → B 16 (G major) → A′ 16 → loop to A (43.6 s).
 * - `m2` — E dorian, 140 bpm: a saw ostinato in 3+3+2, a bugle-like pulse12 lead (leaps of
 *   fourths and fifths), shaker 16ths. intro 8 → A 16 → B 16 (half-time, pulse50 bugle solo)
 *   → A′ 16 (bugles in thirds) → loop to A (82.3 s).
 * - `m3` — B minor with a D-major chorus, 120 bpm: long bass tones, a cold pad, a high lead
 *   with octave-flip "yodel" grace notes, bell icicles, sparse drums.
 *   intro 8 → A 16 → B 16 (major lift) → A′ 16 → loop to A (96 s).
 * - `m4` — C minor night-club swing (2 rows per beat = swung 8ths, swing 0.3), 150 bpm:
 *   walking bass, saw brass stabs on the off-beats, a sly chromatic pulse25 lead, a ride
 *   pattern. A 16 → B 16 → break 8 (bass + drums) → A′ 16 → loop to A (89.6 s).
 * - `anthem` (once) — the Anthem of Eternal Attention, B♭ major, 84 bpm, 8 bars: organ,
 *   pulse50 melody doubled by a saw an octave down, half-note bass, timpani rolls. Its 7th
 *   melody note is a semitone flat (`anthemLine`, shared with `finale.ts`).
 * - `high-score` — A major, 132 bpm, perky: a short pulse25 tune over a bouncing triangle
 *   bass. One 8-bar loop (14.5 s).
 */
import { defineSong } from '../../../engine/audio';
import type { InstrumentDef, SongDef } from '../../../engine/music';
import { anthemLine, harmonize, held, KIT, measures, mel, ORGAN, rep, REST, run16, STAB, transpose } from './index';

// Pitch classes for `harmonize` (the tonic of the major scale used for a bar).
const C = 0;
const D = 2;
const G = 7;
const A = 9;

/** A lead given bar by bar with the scale its harmony line follows (or an explicit harmony bar). */
type LeadBar = readonly [lead: string, harmony: number | string];

function leadOf(list: readonly LeadBar[], rowsPerBar: number): string {
  return measures(list.map(([l]) => l).join(' | '), rowsPerBar);
}

/** The harmony line a diatonic third below, bar by bar (explicit bars are used as written). */
function thirdsOf(list: readonly LeadBar[], rowsPerBar: number): string {
  return measures(list.map(([l, h]) => (typeof h === 'string' ? h : harmonize(mel(l), h, -2))).join(' | '), rowsPerBar);
}

// ---------------------------------------------------------------------------------------------
// select — A major, 128 bpm, bouncy and eager (mode select + character select)
// ---------------------------------------------------------------------------------------------

/** Plucky pulse12: short, bright, for eager staccato 8ths. */
const EAGER_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.003, d: 0.11, s: 0.5, r: 0.05 },
  vol: 0.6,
  vibrato: { rate: 6, depth: 8, delay: 0.2 },
};

/** Four legato quarter notes per bar (a walking bass). */
function walk4(notes: string): string {
  return mel(notes.split(' ').map((n) => `${n}/4`).join(' '));
}

/** Off-beat 8th chords (a ukulele-like strum), one chord per bar or two half bars. */
function offbeats(first: string, second = first): string {
  return `. . ${first} . . . ${first} . . . ${second} . . . ${second} .`;
}

const SEL_CHORD = {
  A: 'A3+C#4+E4',
  Csm: 'G#3+C#4+E4',
  D: 'A3+D4+F#4',
  E: 'G#3+B3+E4',
  E7: 'G#3+B3+D4',
  Fsm: 'A3+C#4+F#4',
  Bm: 'A3+D4+F#4',
};

/** Bars 9–12: the Cygnet hook and its answer, from D up to A, with a run into bar 13. */
const SELECT_HOOK = transpose(measures('F#4/4 D5/10 ./2 | E5/3 D5 B4/3 A4 G4/6 ./2 | G4/4 E5/10 ./2 | F#5/3 E5 C#5/3 B4 A4/4 ./2 A4 B4'), 7);

const SEL_HAT = 'H . h h h . o . H . h h h . o .';
const SEL_HAT_FILL = 'H . h h h . o . H h h h o . o o';

const SELECT: SongDef = {
  bpm: 128,
  vol: 1.2,
  rowsPerBeat: 4,
  order: ['A'],
  loop: 0,
  channels: [
    // Lead: eager hops (bars 1–8), the Cygnet hook (9–12), a run home (13–16).
    {
      inst: EAGER_LEAD,
      vol: 0.95,
      pan: 0.1,
      patterns: {
        A: measures(`
          E5_2 C#5_2 E5_2 A5/4 G#5_2 A5_2 B5_2 |
          C#6/3 B5 G#5_2 E5_2 G#5/6 ./2 |
          F#5_2 D5_2 F#5_2 A5/4 G#5_2 A5_2 F#5_2 |
          E5/6 ./2 B4_2 C#5_2 D5_2 D#5_2 |
          E5_2 C#5_2 E5_2 A5/4 G#5_2 A5_2 B5_2 |
          C#6/3 B5 A5_2 F#5_2 A5/6 ./2 |
          D6_2 C#6_2 B5_2 A5_2 G#5_2 F#5_2 E5_2 D5_2 |
          C#5_2 ./2 A4_2 C#5_2 E5/4 ./4 |
          ${SELECT_HOOK} |
          F#5_2 A5_2 D6/4 C#6_2 B5_2 A5_2 F#5_2 |
          G#5_2 E5_2 G#5_2 C#6/4 B5_2 G#5_2 E5_2 |
          F#5_2 D5_2 F#5_2 A5/4 G#5_2 F#5_2 D5_2 |
          B4_2 E5_2 G#5_2 B5_2 D6/4 C#6_2 B5_2`),
      },
    },
    // Comp: off-beat chords, quiet.
    {
      inst: 'pulse25',
      vol: 0.42,
      pan: -0.3,
      patterns: {
        A: [
          offbeats(SEL_CHORD.A), offbeats(SEL_CHORD.Csm), offbeats(SEL_CHORD.D), offbeats(SEL_CHORD.E),
          offbeats(SEL_CHORD.A), offbeats(SEL_CHORD.Fsm), offbeats(SEL_CHORD.Bm, SEL_CHORD.E7), offbeats(SEL_CHORD.A),
          offbeats(SEL_CHORD.A), offbeats(SEL_CHORD.D), offbeats(SEL_CHORD.Bm), offbeats(SEL_CHORD.E),
          offbeats(SEL_CHORD.D), offbeats(SEL_CHORD.Csm), offbeats(SEL_CHORD.Bm), offbeats(SEL_CHORD.E7),
        ].join(' | '),
      },
    },
    // Walking bass: quarter notes with chromatic steps into the next chord. Under the Cygnet
    // hook (bars 9–12) it breaks into running 16ths: the paddling that always answers the hook.
    {
      inst: 'bass',
      vol: 0.45,
      patterns: {
        A: [
          ...['A2 C#3 E3 D3', 'C#3 G#2 B2 C#3', 'D3 F#3 A2 D#3', 'E3 D3 B2 G#2',
            'A2 B2 C#3 E3', 'F#3 E3 C#3 A2', 'B2 D3 E3 G#2', 'A2 E2 F#2 G#2'].map(walk4),
          run16('A2', 'A3', 'E3', ['A2', 'A3', 'E3', 'C#3']),
          run16('D2', 'D3', 'A2', ['D2', 'D3', 'A2', 'C#3']),
          run16('B1', 'B2', 'F#2', ['B1', 'B2', 'F#2', 'D#2']),
          run16('E2', 'E3', 'B2', ['E2', 'G#2', 'B2', 'C#3']),
          ...['D3 F#3 A2 B2', 'C#3 E3 G#2 A#2', 'B2 A2 F#2 D#2', 'E2 G#2 B2 G#2'].map(walk4),
        ].join(' | '),
      },
    },
    // Hats only.
    { inst: 'drums', vol: 1.2, patterns: { A: [...rep([SEL_HAT, SEL_HAT, SEL_HAT, SEL_HAT_FILL].join(' | '), 4)].join(' | ') } },
  ],
};

// ---------------------------------------------------------------------------------------------
// briefing — G mixolydian, 96 bpm: radio chatter in Gusto's radio box
// ---------------------------------------------------------------------------------------------

/** pulse12 through a narrow band-pass: a small radio speaker. */
const RADIO_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.003, d: 0.1, s: 0.6, r: 0.05 },
  vol: 0.68,
  filter: { type: 'bandpass', freq: 1500, q: 1.4 },
};

const BRUSH = 'b:5 . b:3 . W . b:3 . b:5 . b:3 . W . b:3 b:4';
const BRUSH_FILL = 'b:5 . b:3 . W . b:3 . b:5 b:4 b:5 b:6 W . b b';

const BRIEFING: SongDef = {
  bpm: 96,
  vol: 1.1,
  rowsPerBeat: 4,
  order: ['A'],
  loop: 0,
  channels: [
    // Lead: "dit dit DAH" call signs and a relaxed answer; F natural is the mixolydian 7th.
    {
      inst: RADIO_LEAD,
      vol: 0.9,
      patterns: {
        A: measures(`
          D5 D5 D5_2 ./2 B4_2 C5_2 D5/4 ./2 |
          F5_2 E5_2 C5_2 A4/4 ./2 F4_2 G4_2 |
          D5 D5 D5_2 ./2 B4_2 D5_2 G5/4 ./2 |
          E5/3 D5 C5_2 A4_2 G4/6 ./2 |
          G5_2 G5_2 F5_2 D5_2 B4_2 D5_2 F5/4 |
          A5/3 G5 F5_2 C5_2 A4/6 ./2 |
          D5 D5 D5_2 F5_2 A5/4 G5_2 F5_2 ./2 |
          F5/4 C5_2 A4_2 F4/4 G4_2 B4_2`),
      },
    },
    // Triangle bass: a relaxed long-short skip.
    {
      inst: 'triangle',
      vol: 0.5,
      patterns: {
        A: measures(`
          G2/6 D3/2 G2/6 D3/2 | F2/6 C3/2 F2/6 C3/2 | G2/6 D3/2 G2/6 B2/2 | C3/6 G2/2 C3/4 B2/2 A2/2 |
          G2/6 D3/2 G2/6 D3/2 | F2/6 C3/2 F2/6 A2/2 | D3/6 A2/2 D3/6 C3/2 | F2/6 C3/2 F2/4 E2/2 F#2/2`),
      },
    },
    // Brushes: taps on the 8ths, a sweep on 2 and 4.
    { inst: 'drums', vol: 1.2, kit: KIT, patterns: { A: [...rep(BRUSH, 7), BRUSH_FILL].join(' | ') } },
  ],
};

// ---------------------------------------------------------------------------------------------
// m1 — D major, 6/8 at 132 dotted-quarter bpm (3 rows per beat, 6 rows per bar)
// ---------------------------------------------------------------------------------------------

const M1_BAR = 6;

const M1_A: readonly LeadBar[] = [
  ['A4/2 D5 A5/2 F#5', D], // D
  ['E5/2 F#5 D5/3', D], // D
  ['B4/2 D5 B5/2 G5', D], // G
  ['G5/2 E5 C#5/2 A4', A], // A7
  ['A4/2 D5 A5/2 F#5', D], // D
  ['E5/2 F#5 A5/3', D], // D
  ['B5/2 G#5 E5/2 D5', A], // E7
  ['C#5/3 ./2 A4', A], // A
  ['D5/2 F#5 A5/2 D6', D], // D
  ['C6/2 A5 F#5/2 D5', G], // D7
  ['B5/2 G5 D5/2 B4', D], // G
  ['Bb4/2 D5 G5/2 E5', 'G4/2 Bb4 D5/2 C#5'], // Gm6
  ['F#5/2 E5 F#5/2 A5', D], // D/A
  ['G5/2 E5 C#5/2 E5', A], // A7
  ['F#5/2 E5 D5/3', D], // D
  ['./6', '. . . . . .'], // D
];

/** A′: as A, with a fuller cadence and the intro's pickup back into the loop. */
const M1_A2: readonly LeadBar[] = [
  ...M1_A.slice(0, 13),
  ['E5/2 G5 C#6/2 B5', 'C#5/2 E5 A5/2 G5'], // A7
  ['A5/2 F#5 D6/3', 'F#5/2 D5 A5/3'], // D
  ['./3 E4 F#4 G#4', '. . . . . .'], // D
];

const M1_B: readonly LeadBar[] = [
  ['D5/3 G5/3', G], // G
  ['F#5/2 G5 A5/3', G], // G
  ['G5/3 E5/3', G], // C
  ['F#5/2 E5 D5/2 C5', G], // D7
  ['B4/3 D5/3', G], // G
  ['E5/2 F#5 G5/3', G], // Em
  ['A5/2 G5 E5/2 C#5', D], // A7
  ['D5/3 ./2 D5', G], // D7
  ['B5/2 A5 G5/3', G], // G
  ['F5/3 D5/3', C], // G7
  ['E5/2 G5 C6/3', G], // C
  ['C6/2 Bb5 G5/2 Eb5', 'G5/2 G5 Eb5/2 C5'], // Cm
  ['D5/2 G5 B5/2 G5', G], // G/D
  ['A5/2 F#5 D5/2 C5', G], // D7
  ['B4/3 G4/3', G], // G
  ['G5/2 E5 C#5/2 B4', D], // A7
];

/** Oom on 1 and 4: root, then a second chord tone, each a quarter long. */
function oom(root: string, other: string): string {
  return mel(`${root}/2 . ${other}/2 .`);
}

const M1_OOM = {
  D: oom('D2', 'A2'),
  D7: oom('D2', 'F#2'),
  G: oom('G2', 'D2'),
  Gm: oom('G2', 'Bb1'),
  C: oom('C2', 'G2'),
  Cm: oom('C2', 'Eb2'),
  A: oom('A2', 'E2'),
  A7: oom('A2', 'C#3'),
  E7: oom('E2', 'B2'),
  Em: oom('E2', 'B2'),
  DoverA: oom('A1', 'D2'),
  GoverD: oom('D2', 'G2'),
  G7: oom('G2', 'F2'),
};

const M1_BASS_A = [
  M1_OOM.D, M1_OOM.D, M1_OOM.G, M1_OOM.A7, M1_OOM.D, M1_OOM.D, M1_OOM.E7, M1_OOM.A,
  M1_OOM.D, M1_OOM.D7, M1_OOM.G, M1_OOM.Gm, M1_OOM.DoverA, M1_OOM.A7, M1_OOM.D, M1_OOM.D,
].join(' | ');

const M1_BASS_B = [
  M1_OOM.G, M1_OOM.G, M1_OOM.C, M1_OOM.D7, M1_OOM.G, M1_OOM.Em, M1_OOM.A7, M1_OOM.D7,
  M1_OOM.G, M1_OOM.G7, M1_OOM.C, M1_OOM.Cm, M1_OOM.GoverD, M1_OOM.D7, M1_OOM.G, M1_OOM.A7,
].join(' | ');

const M1_DRUM = 'K . . s . .';
const M1_DRUM_B = 'k . k s . s';
const M1_FILL = 'k . s s S S';
/** One 16-bar drum phrase: a fill closes every 4 bars, a busier bar before it. */
const M1_DRUMS = [...rep([M1_DRUM, M1_DRUM, M1_DRUM_B, M1_FILL].join(' | '), 4)].join(' | ');

const M1: SongDef = {
  bpm: 132,
  rowsPerBeat: 3,
  order: ['intro', 'A', 'B', 'A2'],
  loop: 1,
  channels: [
    // Lead: pulse25.
    {
      inst: 'pulse25',
      vol: 1,
      pan: 0.1,
      patterns: {
        intro: measures('./6 | ./6 | ./6 | ./3 E4 F#4 G#4', M1_BAR),
        A: leadOf(M1_A, M1_BAR),
        B: leadOf(M1_B, M1_BAR),
        A2: leadOf(M1_A2, M1_BAR),
      },
    },
    // Harmony: pulse50 a third below the lead ("pah" chords in the intro).
    {
      inst: 'pulse50',
      vol: 0.55,
      pan: -0.25,
      patterns: {
        intro: measures('. . F#4+A4 . . F#4+A4 | . . F#4+A4 . . F#4+A4 | . . G4+B4 . . G4+B4 | . . G4+C#5 . . .', M1_BAR),
        A: thirdsOf(M1_A, M1_BAR),
        B: thirdsOf(M1_B, M1_BAR),
        A2: thirdsOf(M1_A2, M1_BAR),
      },
    },
    // Bell ornaments at the phrase ends.
    {
      inst: 'bell',
      vol: 0.5,
      pan: 0.3,
      patterns: {
        intro: measures('D6_2 A5_2 F#5_2 | D6_2 A5_2 F#5_2 | B5_2 G5_2 D6_2 | C#6 E6 A6/4', M1_BAR),
        A: measures(
          `./6 | ./6 | ./6 | ./3 A5 C#6 E6 | ./6 | ./6 | ./6 | ./3 E6 C#6 A5 |
           ./6 | ./6 | ./6 | ./6 | ./6 | ./3 A5 C#6 E6 | ./6 | D6 A5 F#5 A5 D6/2`,
          M1_BAR,
        ),
        B: measures(
          `./6 | ./6 | ./6 | ./3 A5 C6 F#6 | ./6 | ./6 | ./6 | ./3 F#6 C6 A5 |
           ./6 | ./6 | ./6 | ./6 | ./6 | ./3 D6 C6 A5 | ./6 | C#6 E6 G6 A6/3`,
          M1_BAR,
        ),
        A2: measures(
          `D6/3 ./3 | ./6 | B5/3 ./3 | ./3 A5 C#6 E6 | D6/3 ./3 | ./6 | B5/3 ./3 | ./3 E6 C#6 A5 |
           D6/3 ./3 | C6/3 ./3 | B5/3 ./3 | Bb5/3 ./3 | A5/3 ./3 | ./3 A5 C#6 E6 | ./6 | D6 A5 F#5 A5 D6/2`,
          M1_BAR,
        ),
      },
    },
    // Bass: oom on 1 and 4.
    {
      inst: 'bass',
      vol: 0.62,
      patterns: {
        intro: [M1_OOM.D, M1_OOM.D, M1_OOM.G, M1_OOM.A].join(' | '),
        A: M1_BASS_A,
        B: M1_BASS_B,
        A2: M1_BASS_A,
      },
    },
    // Drums: kick on 1, snare on 4.
    {
      inst: 'drums',
      vol: 0.75,
      patterns: {
        intro: [M1_DRUM, M1_DRUM, M1_DRUM_B, M1_FILL].join(' | '),
        A: M1_DRUMS,
        B: M1_DRUMS,
        A2: M1_DRUMS,
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// m2 — E dorian, 140 bpm: hot, driving, sandy
// ---------------------------------------------------------------------------------------------

/** 3+3+2 ostinato in 16ths per half bar: root, root, octave · root, root, `tail`. */
function tresillo(root: string, oct: string, tail: string): string {
  return mel(`${root}/3 ${root}/3 ${oct}/2 ${root}/3 ${root}/3 ${tail}/2`);
}

/** The half-time version: 3+3+2 in 8ths across the whole bar. */
function tresilloHalf(root: string, oct: string): string {
  return mel(`${root}/6 ${root}/6 ${oct}/4`);
}

const M2_BASS = {
  Em: tresillo('E2', 'E3', 'D3'),
  A: tresillo('A1', 'A2', 'G2'),
  D: tresillo('D2', 'D3', 'A2'),
  G: tresillo('G1', 'G2', 'D2'),
  Bm: tresillo('B1', 'B2', 'F#2'),
};

const M2_HALF = {
  Em: tresilloHalf('E2', 'E3'),
  D: tresilloHalf('D2', 'D3'),
  A: tresilloHalf('A1', 'A2'),
  G: tresilloHalf('G1', 'G2'),
  Bm: tresilloHalf('B1', 'B2'),
};

/** Bugle-like lead: pulse12 with a quick, narrow vibrato. */
const BUGLE_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.004, d: 0.16, s: 0.62, r: 0.07 },
  vol: 0.6,
  vibrato: { rate: 6.5, depth: 12, delay: 0.16 },
};

/** The pulse50 bugle: a soft attack, a wide vibrato on long notes. */
const BUGLE: InstrumentDef = {
  kind: 'pulse',
  duty: 0.5,
  env: { a: 0.02, d: 0.2, s: 0.75, r: 0.1 },
  vol: 0.22,
  vibrato: { rate: 5.5, depth: 16, delay: 0.25 },
};

const M2_A_LEAD = measures(`
  B4_2 E5/4 B4_2 E5_2 G5_2 F#5_2 E5_2 |
  B5/6 A5_2 G5_2 F#5_2 E5_2 D5_2 |
  E5_2 A5/4 E5_2 A5_2 C#6_2 B5_2 A5_2 |
  E5/8 ./4 B4_2 D5_2 |
  E5_2 B5/4 E5_2 B5_2 D6_2 C#6_2 B5_2 |
  G5/6 F#5_2 E5_2 D5_2 B4_2 A4_2 |
  D5_2 A5/4 F#5_2 D5_2 F#5_2 A5_2 D6_2 |
  C#6/8 B5_2 A5_2 G5_2 F#5_2 |
  B4_2 E5/4 B4_2 E5_2 G5_2 F#5_2 E5_2 |
  B5/4 D6_2 B5_2 A5/4 G5_2 F#5_2 |
  A5/4 E5_2 A5_2 C#6/4 B5_2 A5_2 |
  E5/6 ./6 E5_2 F#5_2 |
  G5/4 D5_2 G5_2 B5/4 A5_2 G5_2 |
  A5/4 E5_2 A5_2 C#6/4 D6_2 C#6_2 |
  B5/8 G5_2 E5_2 B4_2 E5_2 |
  D5/6 ./6 B4_2 D5_2`);

const M2_SHAKE = 'K+z z:4 z z:4 S+z z:4 k+z z:4 z z:4 k+z z:4 S+z z:4 z z:4';
const M2_SHAKE_B = 'K+z z:4 z z:4 S+z z:4 k+z z:4 z z:4 k+z z:4 S+z z:4 s z:4';
const M2_FILL = 'K+z z:4 z z:4 S+z z:4 k+z z:4 s s S s S S S S';
const M2_HALFTIME = 'K+z z:4 z z:4 z z:4 z z:4 S+z z:4 z z:4 z z:4 k+z z:4';
const M2_HALF_FILL = 'K+z z:4 z z:4 z z:4 z z:4 S+z z:4 z z:4 s s S S';
const M2_DRUM_A = [...rep([M2_SHAKE, M2_SHAKE, M2_SHAKE_B, M2_FILL].join(' | '), 4)].join(' | ');

const M2: SongDef = {
  bpm: 140,
  rowsPerBeat: 4,
  order: ['intro', 'A', 'B', 'A2'],
  loop: 1,
  channels: [
    // Lead: pulse12, leaps of fourths and fifths.
    { inst: BUGLE_LEAD, vol: 0.9, pan: 0.1, patterns: { A: M2_A_LEAD, A2: M2_A_LEAD } },
    // Bugle (pulse50): the intro call, the half-time solo, thirds under the lead in A′.
    {
      inst: BUGLE,
      vol: 0.95,
      pan: -0.2,
      patterns: {
        intro: measures(`
          ./16 | ./16 | ./16 | ./16 |
          B4 B4 E5/2 B4 B4 E5/2 G5/4 B5/4 |
          B5/12 ./4 |
          A5 A5 F#5/2 D5/4 A4/4 D5/4 |
          E5/8 C#5_2 E5_2 A5_2 C#6_2`),
        B: measures(`
          E5/6 B4_2 E5_2 B4_2 E5/4 |
          B5/12 ./4 |
          A5/3 F#5 D5/4 A4/4 D5/4 |
          E5/12 ./4 |
          B4_2 B4_2 E5/4 B4_2 B4_2 G5/4 |
          F#5/3 E5 B4/4 E5/8 |
          D5_2 D5_2 A5/4 F#5/3 D5 A4/4 |
          C#5/4 E5/4 A5/8 |
          B5/6 G5_2 D5/8 |
          C#6/6 A5_2 E5/8 |
          D6/6 B5_2 F#5/4 B5/4 |
          A5/6 E5_2 C#5/4 E5/4 |
          G5/4 D5/4 B4/4 D5/4 |
          E5/4 C#5/4 A4/4 C#5/4 |
          D5/4 F#5/4 B5/8 |
          A5/8 F#5/4 D5/4`),
        A2: harmonize(M2_A_LEAD, D, -2),
      },
    },
    // Bass: the 3+3+2 ostinato (half-time in B).
    {
      inst: { kind: 'saw', env: { a: 0.002, d: 0.1, s: 0.5, r: 0.04 }, vol: 0.28, filter: { type: 'lowpass', freq: 900, q: 3, env: 2.8 } },
      vol: 0.95,
      patterns: {
        intro: [M2_BASS.Em, M2_BASS.Em, M2_BASS.Em, M2_BASS.Em, M2_BASS.Em, M2_BASS.Em, M2_BASS.D, M2_BASS.A].join(' | '),
        A: [
          M2_BASS.Em, M2_BASS.Em, M2_BASS.A, M2_BASS.A, M2_BASS.Em, M2_BASS.Em, M2_BASS.D, M2_BASS.A,
          M2_BASS.Em, M2_BASS.Em, M2_BASS.A, M2_BASS.A, M2_BASS.G, M2_BASS.A, M2_BASS.Em, M2_BASS.D,
        ].join(' | '),
        B: [
          M2_HALF.Em, M2_HALF.Em, M2_HALF.D, M2_HALF.A, M2_HALF.Em, M2_HALF.Em, M2_HALF.D, M2_HALF.A,
          M2_HALF.G, M2_HALF.A, M2_HALF.Bm, M2_HALF.A, M2_HALF.G, M2_HALF.A, M2_HALF.Bm, M2_HALF.D,
        ].join(' | '),
        A2: [
          M2_BASS.Em, M2_BASS.Em, M2_BASS.A, M2_BASS.A, M2_BASS.Em, M2_BASS.Em, M2_BASS.D, M2_BASS.A,
          M2_BASS.Em, M2_BASS.Em, M2_BASS.A, M2_BASS.A, M2_BASS.G, M2_BASS.A, M2_BASS.Em, M2_BASS.D,
        ].join(' | '),
      },
    },
    // Drums: shaker 16ths, snare backbeat, the kick follows the 3+3+2.
    {
      inst: 'drums',
      vol: 0.75,
      kit: KIT,
      patterns: {
        intro: [
          ...rep('z z:4 z z:4 z z:4 z z:4 z z:4 z z:4 z z:4 z z:4', 2),
          M2_SHAKE, M2_FILL, M2_SHAKE, M2_SHAKE, M2_SHAKE_B, M2_FILL,
        ].join(' | '),
        A: M2_DRUM_A,
        B: [...rep([M2_HALFTIME, M2_HALFTIME, M2_HALFTIME, M2_HALF_FILL].join(' | '), 4)].join(' | '),
        A2: M2_DRUM_A,
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// m3 — B minor (chorus in D major), 120 bpm: cold, airy, climbing
// ---------------------------------------------------------------------------------------------

/** High pulse25 with a hair of glide, so the octave flips break like a yodel. */
const YODEL_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.006, d: 0.25, s: 0.7, r: 0.12 },
  vol: 0.3,
  vibrato: { rate: 5.6, depth: 12, delay: 0.3 },
  glide: 0.022,
};

/** Cold pad: slow and thin (a wide band-pass takes the warmth out), under the lead. */
const ICE_PAD: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.5, d: 0.8, s: 0.75, r: 1 },
  vol: 0.16,
  detune: 8,
  filter: { type: 'bandpass', freq: 1100, q: 0.45 },
};

const M3_PAD = {
  Bm: held('B3+D4+F#4'),
  G: held('B3+D4+G4'),
  Em: held('B3+E4+G4'),
  Fs: held('A#3+C#4+F#4'),
  A: held('A3+C#4+E4'),
  D: held('A3+D4+F#4'),
  Fsm: held('A3+C#4+F#4'),
};

/** Long bass tones, one per bar. */
const tone = (n: string): string => held(n);

const M3_A_LEAD = measures(`
  B4/6 C#5_2 D5/4 F#5/4 |
  F#6 F#5/7 E5/4 D5/4 |
  G4/6 A4_2 B4/4 D5/4 |
  D6 D5/7 C#5/4 B4/4 |
  E5/6 F#5_2 G5/4 B5/4 |
  B4 B5/7 A5/4 G5/4 |
  F#5/6 G5_2 A#5/4 C#6/4 |
  C#5 C#6/11 ./4 |
  B4/6 C#5_2 D5/4 F#5/4 |
  F#6 F#5/7 A5/4 B5/4 |
  G5/6 F#5_2 E5/4 D5/4 |
  A4 A5/7 G5/4 E5/4 |
  G5/6 F#5_2 E5/4 B4/4 |
  C#5/4 A#4/4 C#5/4 F#5/4 |
  D5/6 C#5_2 B4/8 |
  B5 B4/7 ./8`);

/** A′: the same climb, then the second half goes up to the summit instead of back down. */
const M3_A2_LEAD = measures(`
  B4/6 C#5_2 D5/4 F#5/4 |
  F#6 F#5/7 E5/4 D5/4 |
  G4/6 A4_2 B4/4 D5/4 |
  D6 D5/7 C#5/4 B4/4 |
  E5/6 F#5_2 G5/4 B5/4 |
  B4 B5/7 A5/4 G5/4 |
  F#5/6 G5_2 A#5/4 C#6/4 |
  C#5 C#6/11 ./4 |
  D5/6 E5_2 F#5/4 B5/4 |
  F#6 F#5/7 B5/4 D6/4 |
  D6/6 C#6_2 B5/4 G5/4 |
  E6 E5/7 A5/4 C#6/4 |
  B5/6 A5_2 G5/4 E5/4 |
  F#5/4 A#5/4 C#6/4 E6/4 |
  D6/6 C#6_2 B5/8 |
  B4 B5/7 ./8`);

const M3_ICICLES = measures(`
  ./8 F#6_4 B5_4 | ./16 | ./4 D6_4 ./4 G6_4 | ./16 |
  ./8 E6_4 B5_4 | ./16 | ./4 C#6_4 ./4 F#6_4 | ./16 |
  ./8 F#6_4 B5_4 | ./16 | ./4 D6_4 ./4 G6_4 | ./16 |
  ./8 E6_4 B5_4 | ./16 | ./4 C#6_4 ./4 A#5_4 | ./16`);

const M3_DRUM = 'k . . . . . h . . . k . h . . .';
const M3_DRUM_B = 'k . . . h . . . k . . . h . h .';

const M3: SongDef = {
  bpm: 120,
  vol: 1.07,
  rowsPerBeat: 4,
  order: ['intro', 'A', 'B', 'A2'],
  loop: 1,
  channels: [
    // Lead: climbing phrases with octave-flip grace notes.
    {
      inst: YODEL_LEAD,
      vol: 1.05,
      pan: 0.1,
      patterns: {
        A: M3_A_LEAD,
        B: measures(`
          A4/4 D5/4 F#5/4 A5/4 |
          A4 A5/11 F#5_2 G5_2 |
          E5/4 A5/4 C#6/8 |
          C#6 C#5/7 B4/4 A4/4 |
          B4/4 D5/4 G5/4 B5/4 |
          D6/6 C#6_2 B5/8 |
          C#6/6 B5_2 A5/4 E5/4 |
          A5 A4/11 ./4 |
          F#5/6 G5_2 A5/4 D6/4 |
          C#6/6 B5_2 A5/4 F#5/4 |
          G5/6 A5_2 B5/4 D6/4 |
          E6/12 ./4 |
          D6/6 C#6_2 B5/4 F#5/4 |
          G5/6 F#5_2 E5/4 D5/4 |
          C#5/4 E5/4 A5/8 |
          A#5/6 C#6_2 F#6 F#5/7`),
        A2: M3_A2_LEAD,
      },
    },
    // Bell icicles: sparse, high, cold.
    {
      inst: 'bell',
      vol: 0.66,
      pan: -0.35,
      patterns: {
        intro: measures(`
          ./8 F#6_4 B5_4 | ./16 | ./4 D6_4 ./4 G6_4 | ./16 |
          ./8 E6_4 B5_4 | ./16 | ./4 C#6_4 ./4 F#6_4 | C#6_2 F#6_2 A#6_4 ./8`),
        A: M3_ICICLES,
        B: measures(`
          ./8 A6_4 F#6_4 | ./16 | ./4 E6_4 ./4 A6_4 | ./16 |
          ./8 G6_4 D6_4 | ./16 | ./4 E6_4 ./4 C#6_4 | ./16 |
          ./8 F#6_4 D6_4 | ./16 | ./4 G6_4 ./4 D6_4 | E6_2 A6_2 ./12 |
          ./8 F#6_4 D6_4 | ./16 | ./4 E6_4 ./4 A6_4 | ./16`),
        A2: M3_ICICLES,
      },
    },
    // Cold pad.
    {
      inst: ICE_PAD,
      vol: 0.85,
      pan: 0.25,
      patterns: {
        intro: [M3_PAD.Bm, M3_PAD.Bm, M3_PAD.G, M3_PAD.G, M3_PAD.Em, M3_PAD.Em, M3_PAD.Fs, M3_PAD.Fs].join(' | '),
        A: [
          M3_PAD.Bm, M3_PAD.Bm, M3_PAD.G, M3_PAD.G, M3_PAD.Em, M3_PAD.Em, M3_PAD.Fs, M3_PAD.Fs,
          M3_PAD.Bm, M3_PAD.Bm, M3_PAD.G, M3_PAD.A, M3_PAD.Em, M3_PAD.Fs, M3_PAD.Bm, M3_PAD.Bm,
        ].join(' | '),
        B: [
          M3_PAD.D, M3_PAD.D, M3_PAD.A, M3_PAD.A, M3_PAD.G, M3_PAD.G, M3_PAD.A, M3_PAD.A,
          M3_PAD.D, M3_PAD.Fsm, M3_PAD.G, M3_PAD.A, M3_PAD.Bm, M3_PAD.G, M3_PAD.A, M3_PAD.Fs,
        ].join(' | '),
        A2: [
          M3_PAD.Bm, M3_PAD.Bm, M3_PAD.G, M3_PAD.G, M3_PAD.Em, M3_PAD.Em, M3_PAD.Fs, M3_PAD.Fs,
          M3_PAD.Bm, M3_PAD.Bm, M3_PAD.G, M3_PAD.A, M3_PAD.Em, M3_PAD.Fs, M3_PAD.Bm, M3_PAD.Bm,
        ].join(' | '),
      },
    },
    // Bass: long tones.
    {
      inst: 'bass',
      vol: 0.52,
      patterns: {
        intro: ['B1', 'B1', 'G1', 'G1', 'E2', 'E2', 'F#1', 'F#1'].map(tone).join(' | '),
        A: ['B1', 'B1', 'G1', 'G1', 'E2', 'E2', 'F#1', 'F#1', 'B1', 'B1', 'G1', 'A1', 'E2', 'F#1', 'B1', 'B1'].map(tone).join(' | '),
        B: ['D2', 'D2', 'A1', 'A1', 'G1', 'G1', 'A1', 'A1', 'D2', 'F#1', 'G1', 'A1', 'B1', 'G1', 'A1', 'F#1'].map(tone).join(' | '),
        A2: ['B1', 'B1', 'G1', 'G1', 'E2', 'E2', 'F#1', 'F#1', 'B1', 'B1', 'G1', 'A1', 'E2', 'F#1', 'B1', 'B1'].map(tone).join(' | '),
      },
    },
    // Drums: sparse kick and hat (the intro has none until its last bars).
    {
      inst: 'drums',
      vol: 0.9,
      patterns: {
        intro: [REST, REST, REST, REST, 'h . . . . . h . . . h . . . h .', 'h . . . . . h . . . h . . . h .', M3_DRUM, 'k . . . h . . . k . k . h h h h'].join(' | '),
        A: [...rep([M3_DRUM, M3_DRUM, M3_DRUM, M3_DRUM_B].join(' | '), 4)].join(' | '),
        B: [...rep([M3_DRUM_B, M3_DRUM, M3_DRUM_B, 'k . . . h . . . k . k . h . o .'].join(' | '), 4)].join(' | '),
        A2: [...rep([M3_DRUM, M3_DRUM, M3_DRUM, M3_DRUM_B].join(' | '), 4)].join(' | '),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// m4 — C minor swing, 150 bpm (2 rows per beat: swung 8ths, 8 rows per bar)
// ---------------------------------------------------------------------------------------------

const M4_BAR = 8;

/** Sly lead: pulse25, a slow, late vibrato. */
const SLY_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.006, d: 0.2, s: 0.65, r: 0.08 },
  vol: 0.32,
  vibrato: { rate: 4.8, depth: 16, delay: 0.25 },
};

/** Saw brass section: short, punchy, slightly detuned. */
const BRASS: InstrumentDef = { ...STAB, env: { a: 0.006, d: 0.14, s: 0.3, r: 0.07 }, vol: 0.24 };

/** Close voicings (7th, 3rd, 5th or 3rd, 7th, 9th), kept under the lead. */
const M4_CHORD = {
  Cm7: 'Bb3+Eb4+G4',
  Fm7: 'Ab3+C4+Eb4',
  Ab7: 'Gb3+C4+Eb4',
  G7: 'F3+B3+D4',
  C7: 'Bb3+E4+G4',
  Bb7: 'Ab3+D4+F4',
  Ebmaj7: 'G3+Bb3+D4',
  Dm7b5: 'Ab3+C4+F4',
  Abmaj7: 'G3+C4+Eb4',
  Abm6: 'F3+B3+Eb4',
  Gm7: 'F3+Bb3+D4',
};

/** Brass hits on the "and" of 2 and 4 (one chord per bar). */
const push = (ch: string): string => `. . . ${ch} . . . ${ch}`;
/** The Charleston: a hit on 1 and on the "and" of 2. */
const charleston = (ch: string): string => `${ch} . . ${ch} . . . .`;

/** Walking quarters (2 rows each at 2 rows per beat). */
const walk = (notes: string): string => mel(notes.split(' ').map((n) => `${n}/2`).join(' '));

const M4_A_LEAD = measures(
  `./2 D5 B4 C5/3 G4 |
   Bb4/2 Ab4 G4 Eb4/3 . |
   ./2 G5 E5 F5/3 C5 |
   Eb5/2 Db5 C5 Ab4/3 . |
   ./2 D5 B4 C5 Eb5 G5/2 |
   Ab5 G5 F5 Eb5 C5/4 |
   ./2 C5 Eb5 Gb5/2 F5 Eb5 |
   D5 B4/3 Ab4 G4/3 |
   ./2 D5 B4 C5/3 G4 |
   Bb4/2 A4 Bb4 E5/3 . |
   F5/4 Eb5 C5 Ab4 F4 |
   ./2 F4 Ab4 D5/3 C5 |
   Bb4/3 G4/2 Bb4 D5/2 |
   C5/3 Eb5/2 Gb5 F5/2 |
   F5/2 Eb5 D5 Ab4/4 |
   B4 D5 F5 Ab5 G5/3 .`,
  M4_BAR,
);

/** A′: bars 1–8 as A, then 8th-note lines that run up through the changes. */
const M4_A2_LEAD = measures(
  `./2 D5 B4 C5/3 G4 |
   Bb4/2 Ab4 G4 Eb4/3 . |
   ./2 G5 E5 F5/3 C5 |
   Eb5/2 Db5 C5 Ab4/3 . |
   ./2 D5 B4 C5 Eb5 G5/2 |
   Ab5 G5 F5 Eb5 C5/4 |
   ./2 C5 Eb5 Gb5/2 F5 Eb5 |
   D5 B4/3 Ab4 G4/3 |
   G5 F#5 G5 Eb5 C5/2 ./2 |
   E5 F5 E5 D5 C5 Bb4 G4/2 |
   Ab4 C5 Eb5 G5 F5/4 |
   D5 Eb5 E5 F5 Ab5/2 G5/2 |
   G5/3 F5 Eb5 D5 Bb4/2 |
   C5 Eb5 Gb5 Bb5 Ab5/4 |
   Ab5 G5 F5 D5 Ab4/2 B4/2 |
   D5 F5 Ab5 B5 D6/3 .`,
  M4_BAR,
);

const M4_A_HARMONY = ['Cm7', 'Cm7', 'Fm7', 'Fm7', 'Cm7', 'Cm7', 'Ab7', 'G7', 'Cm7', 'C7', 'Fm7', 'Bb7', 'Ebmaj7', 'Ab7', 'Dm7b5', 'G7'] as const;
const M4_B_HARMONY = ['Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Ebmaj7', 'Cm7', 'Fm7', 'Bb7', 'Abmaj7', 'Abm6', 'Gm7', 'C7', 'Fm7', 'Bb7', 'Dm7b5', 'G7'] as const;

const M4_A_WALK = [
  'C3 Eb3 G3 B2', 'C3 D3 Eb3 E3', 'F2 Ab2 C3 E2', 'F2 G2 Ab2 A2',
  'C3 G2 Eb2 G2', 'C3 Bb2 A2 Ab2', 'Ab2 C3 Eb3 Gb2', 'G2 B2 D3 Db3',
  'C3 Eb3 G3 B2', 'C3 E3 G3 Bb2', 'F2 Ab2 C3 A2', 'Bb2 D3 F3 E3',
  'Eb3 G3 Bb2 Bb2', 'Ab2 C3 Eb3 Eb2', 'D2 F2 Ab2 Ab2', 'G2 B2 D3 Db3',
].map(walk).join(' | ');

const M4_B_WALK = [
  'Eb2 G2 Bb2 D3', 'C3 Bb2 G2 Eb2', 'F2 Ab2 C3 Eb3', 'Bb2 Ab2 F2 D2',
  'Eb2 F2 G2 Bb2', 'C3 D3 Eb3 C3', 'F2 G2 Ab2 A2', 'Bb2 C3 D3 D2',
  'Ab2 C3 Eb3 G2', 'Ab2 B2 Eb3 F2', 'G2 Bb2 D3 Db3', 'C3 E3 G3 Gb2',
  'F2 Ab2 C3 Eb3', 'Bb2 D3 F3 B2', 'D2 F2 Ab2 C3', 'G2 B2 D3 Db3',
].map(walk).join(' | ');

const M4_RIDE = 'd . d+h d d . d+h d';
const M4_RIDE_K = 'k:5+d . d+h d k:4+d . d+h d';
const M4_SNARE = 'd . d+h d+s:4 d . d+h+s:5 d';
const M4_FILL = 'k+d . d+h s:5 s:6 s:7 S S';
const M4_DRUM_A = [...rep([M4_RIDE_K, M4_RIDE, M4_SNARE, M4_RIDE].join(' | '), 3), M4_RIDE_K, M4_RIDE, M4_SNARE, M4_FILL].join(' | ');

const M4: SongDef = {
  bpm: 150,
  vol: 1.06,
  rowsPerBeat: 2,
  swing: 0.3,
  order: ['A', 'B', 'break', 'A2'],
  loop: 0,
  channels: [
    // Lead: enclosures (a note above, a note below, then the target), blue notes.
    {
      inst: SLY_LEAD,
      vol: 0.85,
      pan: 0.1,
      patterns: {
        A: M4_A_LEAD,
        B: measures(
          `G5/6 F#5 G5 |
           Eb5/4 C5/2 Bb4/2 |
           Ab5/6 G5 Ab5 |
           F5/4 D5/2 Ab4/2 |
           G5/2 Bb5/2 D6/4 |
           C6/2 Bb5 G5 Eb5/4 |
           F5/2 Ab5 C6 Bb5/2 Ab5 F5 |
           D5/6 ./2 |
           C5/2 Eb5 G5/5 |
           F5/2 Eb5 B4/5 |
           D5/2 F5 Bb5/5 |
           Bb5/2 G5 E5/5 |
           Ab5/2 G5 F5 C5/4 |
           D5/2 F5 Ab5 G5/4 |
           Ab5/2 F5 D5 C5/4 |
           B4/2 D5 F5 Ab5/2 G5/2`,
          M4_BAR,
        ),
        A2: M4_A2_LEAD,
      },
    },
    // Brass stabs on the off-beats.
    {
      inst: BRASS,
      vol: 0.85,
      pan: -0.25,
      patterns: {
        A: M4_A_HARMONY.map((h, i) => (i % 4 === 3 ? charleston(M4_CHORD[h]) : push(M4_CHORD[h]))).join(' | '),
        B: M4_B_HARMONY.map((h, i) => (i % 2 === 0 ? push(M4_CHORD[h]) : charleston(M4_CHORD[h]))).join(' | '),
        A2: M4_A_HARMONY.map((h, i) => (i % 4 === 3 ? charleston(M4_CHORD[h]) : push(M4_CHORD[h]))).join(' | '),
      },
    },
    // Walking bass (it plays alone with the drums in the break).
    {
      inst: { kind: 'triangle', env: { a: 0.004, d: 0.15, s: 0.6, r: 0.05 }, vol: 0.46 },
      vol: 0.6,
      patterns: {
        A: M4_A_WALK,
        B: M4_B_WALK,
        break: [
          'C3 Eb3 G3 A3', 'Bb3 G3 Eb3 B2', 'C3 Eb3 F3 F#3', 'G3 F3 Eb3 D3',
          'C3 B2 Bb2 A2', 'Ab2 G2 F2 Eb2', 'D2 F2 Ab2 C3', 'B2 G2 D2 B1',
        ]
          .map(walk)
          .join(' | '),
        A2: M4_A_WALK,
      },
    },
    // Drums: a swung ride pattern, the hat on 2 and 4, snare comping, fills.
    {
      inst: 'drums',
      vol: 0.8,
      kit: KIT,
      patterns: {
        A: M4_DRUM_A,
        B: M4_DRUM_A,
        break: [M4_RIDE_K, M4_SNARE, M4_RIDE_K, M4_FILL, M4_RIDE_K, M4_SNARE, M4_RIDE_K, 'S . s:5 S . s:6 S S'].join(' | '),
        A2: M4_DRUM_A,
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// anthem — the Anthem of Eternal Attention: B♭ major, 84 bpm, 8 bars, plays once
// ---------------------------------------------------------------------------------------------

/** Organ chords, one per half bar (B♭ major), voiced around the melody. */
const ANTHEM_ORGAN = measures(`
  Bb3+D4+F4/8 C4+Eb4+G4/8 |
  Bb3+D4+F4/8 A3+C4+Eb4+F4/8 |
  Bb3+D4+F4/8 Bb3+C4+Eb4+G4/8 |
  A3+C4+F4/12 A3+C4+Eb4+F4/4 |
  G3+Bb3+D4/8 Bb3+D4+F4/8 |
  C4+Eb4+G4/8 A3+C4+Eb4/8 |
  Bb3+D4+F4/8 Bb3+Eb4+G4/6 A3+C4+Eb4/2 |
  Bb3+D4+F4+Bb4/12 ./4`);

/** The anthem's pulse50 melody: a slow swell and a wide, proud vibrato. */
const ANTHEM_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.5,
  env: { a: 0.02, d: 0.2, s: 0.8, r: 0.12 },
  vol: 0.26,
  vibrato: { rate: 5, depth: 20, delay: 0.3 },
};

const ANTHEM: SongDef = {
  bpm: 84,
  vol: 0.8,
  rowsPerBeat: 4,
  order: ['A'],
  loop: null,
  channels: [
    // The melody (pulse50), wrong note and all.
    { inst: ANTHEM_LEAD, vol: 1, pan: 0.1, patterns: { A: anthemLine() } },
    // The same melody an octave down on a saw.
    { inst: 'saw', vol: 0.7, pan: -0.1, patterns: { A: anthemLine({ transpose: -12 }) } },
    // Organ.
    { inst: ORGAN, vol: 0.7, patterns: { A: ANTHEM_ORGAN } },
    // Bass in half notes.
    {
      inst: 'bass',
      vol: 0.7,
      patterns: {
        A: measures('Bb1/8 C2/8 | F1/8 F2/8 | Bb1/8 C2/8 | F1/8 F2/8 | G1/8 D2/8 | C2/8 F1/8 | D2/8 Eb2/6 F2/2 | Bb1/12 ./4'),
      },
    },
    // Timpani rolls (crescendo into the half cadence and the last chord), crash on the big notes.
    {
      inst: 'drums',
      vol: 0.5,
      kit: KIT,
      patterns: {
        A: measures(`
          C+M ./7 m ./7 |
          M ./7 m ./3 m:3 m:4 m:5 m:6 |
          M ./7 m ./7 |
          M ./7 m:3 m:3 m:4 m:5 m:6 m:7 m:8 m:9 |
          C+M ./7 m ./7 |
          M ./7 m ./3 m:4 m:5 m:6 m:7 |
          M ./7 m:4 m:4 m:5 m:6 m:7 m:8 M M |
          C+M ./5 m:4 m:5 m:6 m:7 m:8 m:9 C+M ./3`),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// high-score — A major, 132 bpm, perky (name entry and the high-score table)
// ---------------------------------------------------------------------------------------------

const HIGH_SCORE: SongDef = {
  bpm: 132,
  vol: 1.17,
  rowsPerBeat: 4,
  order: ['A'],
  loop: 0,
  channels: [
    {
      inst: 'pulse25',
      vol: 1,
      pan: 0.1,
      patterns: {
        A: measures(`
          E5_2 A5_2 C#6_2 A5_2 B5/4 A5_2 G#5_2 |
          F#5/4 E5_2 D5_2 F#5/6 ./2 |
          G#5_2 B5_2 E6_2 B5_2 C#6/4 B5_2 A5_2 |
          C#6/6 ./2 E5_2 F#5_2 G#5_2 ./2 |
          F#5_2 A5_2 C#6/4 B5_2 A5_2 F#5/4 |
          D5_2 F#5_2 A5/4 G#5_2 A5_2 B5/4 |
          D6/3 C#6 B5_2 A5_2 G#5/4 E5_2 F#5_2 |
          A5/4 E5_2 C#5_2 A4/6 ./2`),
      },
    },
    // Triangle bass: bouncing octaves.
    {
      inst: 'triangle',
      vol: 0.5,
      patterns: {
        A: measures(`
          A2/2 A3/2 E3/2 A3/2 A2/2 A3/2 E3/2 C#3/2 |
          D3/2 D2/2 A2/2 D3/2 D3/2 D2/2 A2/2 F#2/2 |
          E2/2 E3/2 B2/2 E3/2 E2/2 E3/2 B2/2 G#2/2 |
          A2/2 A3/2 E3/2 A3/2 A2/2 E3/2 C#3/2 E3/2 |
          F#2/2 F#3/2 C#3/2 F#3/2 F#2/2 F#3/2 C#3/2 A2/2 |
          D3/2 D2/2 A2/2 D3/2 D3/2 D2/2 E2/2 F#2/2 |
          B2/2 B1/2 F#2/2 B2/2 E2/2 E3/2 B2/2 G#2/2 |
          A2/2 E3/2 A3/2 E3/2 A2/4 E2/2 G#2/2`),
      },
    },
    // A light tick on the beats.
    { inst: 'drums', vol: 1.1, patterns: { A: [...rep('h . . . r . h . h . . . r . h h', 7), 'h . . . r . h . h . r . r . r r'].join(' | ') } },
  ],
};

/** Songs of this module by id (tests parse them). */
export const MISSION_SONGS: Readonly<Record<string, SongDef>> = {
  select: SELECT,
  briefing: BRIEFING,
  m1: M1,
  m2: M2,
  m3: M3,
  m4: M4,
  anthem: ANTHEM,
  'high-score': HIGH_SCORE,
};

for (const [id, song] of Object.entries(MISSION_SONGS)) defineSong(id, song);
