/**
 * Songs of the last mission and the finale (GDD §12.2, §15.8; manifest entry 'music/finale').
 * Registers at import time. Every note was composed for METAL SWAN 3 (docs/ORIGINALITY.md):
 * the only quotes are the game's own leitmotifs from `music/index.ts` (the Cygnet hook and the
 * Anthem of Eternal Attention, with its 7th note a semitone flat).
 *
 * - `m5-sky` — F major → D minor, 160 bpm. Soaring flight at dusk: the Cygnet hook in triumph
 *   (augmented, long pulse50 notes) over racing saw arpeggios and pad swells, a kick on every
 *   beat. intro 8 → A 16 (hook, F major) → B 16 (the hook in D minor; night falls) → C 8 (the
 *   hook at full speed, played as 'C+2': a whole step up) → loop to A (60 s).
 * - `m5-organ` — D minor, 108 bpm, inside the Grand Organ: organ drones over a pedal, a
 *   triangle gear ostinato, bell clock ticks (tick on 2, tock on 4), pulse25 fragments of the
 *   anthem bent out of shape (with a cavern echo), a heavy kick on 1 and 3. A 16 → B 16 (71 s).
 * - `mini-boss` — E minor, 150 bpm, urgent and cheeky: a 2-bar saw bass ostinato with a blue
 *   note, pulse50 stabs that taunt, snare rolls, bell hits. One 16-bar loop (25.6 s).
 * - `boss-final` — C minor, 168 bpm, grand, pompous, desperate: full organ, saw bass, both
 *   pulses in counterpoint, triangle, full drums with timpani. intro 8 (the organ alone, then a
 *   toccata of arpeggios) → A 16 → B 16 (pompous long notes) → C 16 (the anthem in C minor at
 *   half speed, its wrong note intact and grinding against the organ) → loop to A (68.6 s).
 * - `boss-final-fast` — C minor, 200 bpm, the maestro's Tempo!: its own song (not a sped-up
 *   copy). A 8 (the boss-final motif in a 16th-note frenzy) → B 8 (the anthem rushed through at
 *   full gallop) → loop (19.2 s). Bar 1 is already at full tilt: a Tempo! lasts about 4 bars.
 * - `ending` — D major, 116 bpm, the parade (plays once, 32 bars, then `credits`): fanfare 4 →
 *   A 8 (the Cygnet hook as a march) → T 8 (the title's counter-melody, lighter) → G 8 (the hook
 *   with the anthem as a bell counter-line, in tune except its one wrong note) → coda 4: the
 *   hook resolves on the tonic for the first time; after the last chord, one triangle "ting"
 *   at the wrong time (Fanfaroni's one note).
 * - `credits` — G major, 100 bpm, relaxed swing (3 rows per beat = triplet 8ths): the title
 *   theme as a 32-bar AABA tune — pulse25 swan lead, walking triangle bass, a soft electric
 *   piano, brushes. Loops (76.8 s).
 *
 * The organ is built like a real one: each stop is its own channel playing the same notes at its
 * own pitch ("footage") — principal 8′ (25 % pulse, two pipes a few cents apart, a short bright
 * chiff), flute 4′, bourdon 16′, a quint mixture 2 2/3′ and, for the full organ, a trumpet reed.
 */
import { defineSong } from '../../../engine/audio';
import { patternRows } from '../../../engine/music';
import type { ChannelDef, InstrumentDef, SongDef } from '../../../engine/music';
import {
  anthemLine,
  bars,
  CYGNET_ANSWER,
  CYGNET_HOOK,
  DRIVE_BASS,
  KIT,
  measures,
  pump,
  rep,
  REST,
  STAB,
  SWAN_LEAD,
  transpose,
} from './index';

// ---------------------------------------------------------------------------------------------
// Pattern helpers (the shared ones live in music/index.ts)
// ---------------------------------------------------------------------------------------------

/** Every row lasts `k` rows (augmentation): notes are held, rests stay rests. */
export function stretch(pattern: string, k: number): string {
  const out: string[] = [];
  for (const tok of patternRows(pattern)) {
    out.push(tok);
    for (let i = 1; i < k; i++) out.push(tok === '.' ? '.' : '-');
  }
  return out.join(' ');
}

/** Sets the velocity (1–9) of every note of a melodic pattern (accents are dropped). */
export function vel(pattern: string, v: number): string {
  return patternRows(pattern)
    .map((tok) =>
      tok === '.' || tok === '-'
        ? tok
        : tok
            .split('+')
            .map((p) => `${p.replace(/(!|:[1-9])$/, '')}:${v}`)
            .join('+'),
    )
    .join(' ');
}

/** The same pattern `rows` rows later (an echo). Only rests and holds may fall off the end. */
export function delay(pattern: string, rows: number): string {
  const toks = patternRows(pattern);
  const cut = toks.slice(toks.length - rows);
  if (cut.some((t) => t !== '.' && t !== '-')) throw new Error('music/finale: delay() would cut off a note');
  return [...Array.from({ length: rows }, () => '.'), ...toks.slice(0, toks.length - rows)].join(' ');
}

/** One bar of 16ths: an 8-note arpeggio cell played twice. */
function twice(cell: string): string {
  return `${cell} ${cell}`;
}

/** Bars of chords; a chord equal to the bar before is held on (no new attack: pads swell on). */
function chordBars(list: readonly string[]): string {
  return measures(list.map((c, i) => (i > 0 && c === list[i - 1] ? '-/16' : `${c}/16`)).join(' | '));
}

/** Octave 8ths for two chords in one bar (half a bar each). */
function pump2(low1: string, high1: string, low2: string, high2: string): string {
  return `${low1} . ${high1} . ${low1} . ${high1} . ${low2} . ${high2} . ${low2} . ${high2} .`;
}

/** Bars 5–8 of the title's A section: the hook climbs to A5, then closes on E4 (D major). */
const CYGNET_RISE = measures('F#4/4 D5/10 F#5 G5 | A5/3 G5 F#5/3 E5 D5/3 B4/5');
const CYGNET_CLOSE = measures('D5/3 C#5 B4/3 A4 F#4/4 A4/4 | E4/12 ./4');

/** The whole 8-bar Cygnet theme as the title sings it (D major, 16 rows per bar). */
const CYGNET_THEME = [CYGNET_HOOK, CYGNET_ANSWER, CYGNET_RISE, CYGNET_CLOSE].join(' ');

// ---------------------------------------------------------------------------------------------
// The organ (m5-organ, boss-final)
// ---------------------------------------------------------------------------------------------

/** One organ stop: an instrument, its pitch offset in semitones (its "footage") and its level. */
interface Stop {
  inst: InstrumentDef;
  transpose: number;
  vol: number;
}

/** Principal 8′: a 25 % pulse, two pipes 4 cents apart, a short bright chiff as the pipe speaks. */
const PRINCIPAL: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.03, d: 0.15, s: 0.9, r: 0.26 },
  vol: 0.15,
  detune: 4,
  filter: { type: 'lowpass', freq: 2200, q: 0.9, env: 1.9 },
};

/** The principal with a tremulant: the machine breathes (m5-organ). */
const PRINCIPAL_TREMULANT: InstrumentDef = { ...PRINCIPAL, tremolo: { rate: 5.6, depth: 0.22 } };

/** Flute 4′: a soft triangle an octave up. */
const FLUTE: InstrumentDef = { kind: 'triangle', env: { a: 0.045, d: 0.1, s: 0.95, r: 0.24 }, vol: 0.2 };

/** Bourdon 16′: a round sine an octave down, the floor of the sound. */
const BOURDON: InstrumentDef = { kind: 'sine', env: { a: 0.07, d: 0.1, s: 1, r: 0.3 }, vol: 0.17 };

/** Mixture (a quint, 2 2/3′): a thin sine a twelfth up — the bright "church" shimmer. */
const MIXTURE: InstrumentDef = { kind: 'sine', env: { a: 0.03, d: 0.1, s: 1, r: 0.22 }, vol: 0.06 };

/** Trumpet 8′, a reed: a filtered saw that makes the full organ blaze. */
const REED: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.02, d: 0.2, s: 0.85, r: 0.2 },
  vol: 0.1,
  filter: { type: 'lowpass', freq: 1700, q: 1.1, env: 1.5 },
};

/** Soft registration with a tremulant: principal 8′, flute 4′, bourdon 16′. */
const SWELL_ORGAN: readonly Stop[] = [
  { inst: PRINCIPAL_TREMULANT, transpose: 0, vol: 1 },
  { inst: FLUTE, transpose: 12, vol: 0.55 },
  { inst: BOURDON, transpose: -12, vol: 0.8 },
];

/** Full organ: principal 8′, flute 4′, bourdon 16′, mixture 2 2/3′ and the trumpet reed. */
const FULL_ORGAN: readonly Stop[] = [
  { inst: PRINCIPAL, transpose: 0, vol: 1 },
  { inst: FLUTE, transpose: 12, vol: 0.6 },
  { inst: BOURDON, transpose: -12, vol: 0.7 },
  { inst: MIXTURE, transpose: 19, vol: 1 },
  { inst: REED, transpose: 0, vol: 0.9 },
];

/** Pedal: the bass line on a bourdon with a soft principal an octave up for definition. */
const PEDAL: readonly Stop[] = [
  { inst: BOURDON, transpose: 0, vol: 1.3 },
  { inst: PRINCIPAL, transpose: 12, vol: 0.45 },
];

/** Full pedal: adds a trumpet reed at the written pitch (boss-final). */
const FULL_PEDAL: readonly Stop[] = [...PEDAL, { inst: REED, transpose: 0, vol: 1.1 }];

/** One channel per stop, all playing the same patterns (a registration). */
function organ(stops: readonly Stop[], patterns: Readonly<Record<string, string>>, vol = 1, pan = 0): ChannelDef[] {
  return stops.map((s) => ({ inst: s.inst, vol: s.vol * vol, pan, transpose: s.transpose, patterns }));
}

// ---------------------------------------------------------------------------------------------
// m5-sky — F major → D minor, 160 bpm
// ---------------------------------------------------------------------------------------------

/** Long-note pulse50 lead: two pipes slightly apart, a late vibrato, a quick glide on leaps. */
const SKY_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.5,
  env: { a: 0.012, d: 0.35, s: 0.8, r: 0.24 },
  vol: 0.2,
  detune: 7,
  vibrato: { rate: 5.4, depth: 16, delay: 0.3 },
  glide: 0.04,
};

/** Plucky saw for the racing 16th arpeggios (the filter snaps open on every note). */
const SKY_ARP: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.002, d: 0.08, s: 0.3, r: 0.05 },
  vol: 0.19,
  filter: { type: 'lowpass', freq: 1500, q: 3.5, env: 2.4 },
};

/** Slow pad swell. */
const SWELL: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.9, d: 1.2, s: 0.8, r: 1.1 },
  vol: 0.13,
  detune: 13,
  filter: { type: 'lowpass', freq: 1700, q: 0.8 },
};

/** 8-note arpeggio cells (played twice per bar). */
const SKY_ARPS: Readonly<Record<string, string>> = {
  F: 'F3 C4 F4 A4 C5 A4 F4 C4',
  Dm: 'D3 A3 D4 F4 A4 F4 D4 A3',
  Dm7: 'C4 D4 F4 A4 C5 A4 F4 D4',
  Bb: 'Bb3 D4 F4 Bb4 D5 Bb4 F4 D4',
  Gm: 'G3 D4 G4 Bb4 D5 Bb4 G4 D4',
  Eb: 'Bb3 Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4',
  C: 'C4 E4 G4 C5 E5 C5 G4 E4',
  C7: 'C4 E4 G4 Bb4 C5 Bb4 G4 E4',
  A: 'A3 E4 A4 C#5 E5 C#5 A4 E4',
  A7: 'A3 E4 G4 C#5 E5 C#5 G4 E4',
  D: 'D4 F#4 A4 D5 F#5 D5 A4 F#4',
  Bb7: 'Bb3 D4 F4 Ab4 Bb4 Ab4 F4 D4',
};

const SKY_PADS: Readonly<Record<string, string>> = {
  F: 'F3+C4+A4',
  Fadd9: 'F3+C4+G4+A4',
  Dm: 'D3+A3+F4',
  Dm7: 'C4+F4+A4',
  Bb: 'Bb3+D4+F4',
  Gm: 'G3+D4+Bb4',
  Eb: 'Eb4+G4+Bb4',
  C: 'G3+C4+E4',
  C7: 'G3+Bb3+E4',
  A: 'A3+C#4+E4',
  A7: 'G3+C#4+E4',
  D: 'A3+D4+F#4',
};

const SKY_BASS: Readonly<Record<string, string>> = {
  F: pump('F2', 'F3'),
  'F>': pump('F2', 'F3', 'A2'),
  Bb: pump('Bb1', 'Bb2'),
  'Bb>': pump('Bb1', 'Bb2', 'B1'),
  Gm: pump('G2', 'G3'),
  C: pump('C2', 'C3'),
  'C>': pump('C2', 'C3', 'E2'),
  Dm: pump('D2', 'D3'),
  Dm7: pump('C2', 'C3'),
  Eb: pump('Eb2', 'Eb3'),
  A: pump('A1', 'A2'),
  'A>': pump('A1', 'A2', 'C#2'),
  D: pump('D2', 'D3'),
};

/** Chord names per bar of each section (bar 8 of C: C, then B♭7 — heard as D, then C7). */
const SKY_CHORDS = {
  intro: ['F', 'F', 'Dm', 'Dm', 'F', 'F', 'Bb', 'C7'],
  A: ['F', 'F', 'Bb', 'Bb', 'Gm', 'Gm', 'C', 'C', 'F', 'F', 'Bb', 'Bb', 'Dm', 'Dm', 'C', 'C'],
  B: ['Dm', 'Dm', 'Gm', 'Gm', 'Eb', 'Eb', 'A', 'A', 'Dm', 'Dm7', 'Bb', 'Bb', 'Gm', 'A7', 'D', 'D'],
  C: ['F', 'Bb', 'Gm', 'C', 'F', 'Bb', 'Dm'],
} as const;

const skyArps = (list: readonly string[], v?: number): string => {
  const p = bars(...list.map((c) => twice(SKY_ARPS[c])));
  return v === undefined ? p : vel(p, v);
};

const SKY_BEAT = 'K . h . k+s . h . k . h . k+s . h .';
const SKY_BEAT_B = 'k . h . k+s . h . k . h k k+s . h .';
const SKY_CRASH = 'K+c . h . k+s . h . k . h . k+s . h .';
const SKY_DRIVE = 'K . h k k+S . h . K . h k k+S . h h';
const SKY_FILL = 'k . h . k+s . h . k . s s S s S S';
const SKY_TOMS = 'k . h . k+s . h . k t:5 t:5 t:5 t:6 t:6 t:7 t:7';
const SKY_ROLL = 's:4 s:4 s:5 s:5 s:6 s:6 s:7 s:7 s s s s S S S S';
const SKY_HATS = 'h:3 . h:4 . h:3 . h:5 . h:3 . h:4 . h:3 . h:6 .';

/** The lead of C (written in F major, heard a whole step up): the hook at its own speed. */
const SKY_C_LEAD = `${transpose([CYGNET_HOOK, CYGNET_ANSWER, CYGNET_RISE].join(' '), 3)} ${measures(
  // The last bar pivots back to F major: G4 over C (heard: D), then A♭ F over B♭7 (heard: C7).
  'F5/3 E5 D5/3 C5 A4/4 C5/4 | G4/8 Ab4/4 F4/4',
)}`;

const M5_SKY: SongDef = {
  bpm: 160,
  rowsPerBeat: 4,
  // Mix level: about −20 dB RMS like the other songs (tools: npm run audio -- --songs).
  vol: 0.92,
  order: ['intro', 'A', 'B', 'C+2'],
  loop: 1,
  channels: [
    // Lead: a teaser of the hook's leap, then the hook in triumph (twice as slow), the hook in
    // D minor as night falls, and the hook at full speed a whole step up.
    {
      inst: SKY_LEAD,
      vol: 1,
      pan: 0.05,
      patterns: {
        intro: measures('./16 | ./16 | ./16 | ./16 | C5/4 A5/12 | -/16 | Bb5/8 F5/8 | G5/8 E5/4 C5/4'),
        A: stretch(transpose(CYGNET_THEME, 3), 2),
        B: measures(
          'F4/8 D5/8 | -/16 | E5/6 D5/2 Bb4/6 A4/2 | G4/12 ./4 | Bb4/8 G5/8 | -/16 | A5/6 G5/2 E5/6 D5/2 | C#5/12 ./4 |' +
            'A5/6 G5/2 F5/8 | E5/6 F5/2 D5/8 | D6/8 C6/4 Bb5/4 | F5/12 G5/2 A5/2 | Bb5/6 A5/2 G5/8 | A5/6 G5/2 E5/4 C#5/4 | D5/16 | D5/4 E5/4 F#5/4 A5/4',
        ),
        C: SKY_C_LEAD,
      },
    },
    // Harmony: thirds under the second half of each long section, the octave below in C.
    {
      inst: 'pulse25',
      vol: 0.5,
      pan: -0.3,
      patterns: {
        A: measures(
          './16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./16 |' +
            'F4/8 C5/8 | -/12 F5/2 G5/2 | A5/6 G5/2 F5/6 E5/2 | D5/6 Bb4/10 | D5/6 C5/2 A4/8 | F4/8 A4/8 | E4/16 | -/8 ./8',
        ),
        B: measures('./16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./16 | D5/16 | A4/16 | F5/16 | D5/16 | D5/16 | C#5/16 | F#4/16 | A4/16'),
        C: transpose(SKY_C_LEAD, -12),
      },
    },
    // Arpeggios: racing 16ths (the paddling, high above the clouds); a crescendo in the intro.
    {
      inst: SKY_ARP,
      vol: 0.85,
      pan: 0.25,
      patterns: {
        intro: [skyArps(SKY_CHORDS.intro.slice(0, 2), 3), skyArps(SKY_CHORDS.intro.slice(2, 4), 4), skyArps(SKY_CHORDS.intro.slice(4, 6), 5), skyArps(SKY_CHORDS.intro.slice(6), 7)].join(' '),
        A: skyArps(SKY_CHORDS.A),
        B: skyArps(SKY_CHORDS.B),
        C: `${skyArps(SKY_CHORDS.C)} ${SKY_ARPS.C} ${SKY_ARPS.Bb7}`,
      },
    },
    // Pad swells.
    {
      inst: SWELL,
      vol: 0.8,
      pan: -0.15,
      patterns: {
        intro: chordBars(['Fadd9', 'Fadd9', 'Dm', 'Dm', 'F', 'F', 'Bb', 'C7'].map((c) => SKY_PADS[c])),
        A: chordBars(SKY_CHORDS.A.map((c) => SKY_PADS[c])),
        B: chordBars(SKY_CHORDS.B.map((c) => SKY_PADS[c])),
        C: `${chordBars(SKY_CHORDS.C.map((c) => SKY_PADS[c]))} ${measures('G3+C4+E4/8 Ab3+Bb3+D4/8')}`,
      },
    },
    // Bass: long roots, then octave 8ths that walk into the next chord.
    {
      inst: DRIVE_BASS,
      vol: 0.9,
      patterns: {
        intro: `${measures('F2/16 | -/16 | D2/16 | -/16')} ${bars(SKY_BASS.F, SKY_BASS['F>'], SKY_BASS['Bb>'], SKY_BASS['C>'])}`,
        A: bars(
          ...['F', 'F>', 'Bb', 'Bb', 'Gm', 'Gm', 'C', 'C>', 'F', 'F>', 'Bb', 'Bb', 'Dm', 'Dm', 'C', 'C'].map((c) => SKY_BASS[c]),
        ),
        B: bars(...['Dm', 'Dm', 'Gm', 'Gm', 'Eb', 'Eb', 'A', 'A', 'Dm', 'Dm7', 'Bb', 'Bb', 'Gm', 'A>', 'D', 'D'].map((c) => SKY_BASS[c])),
        C: bars(...['F', 'Bb', 'Gm', 'C', 'F', 'Bb', 'Dm'].map((c) => SKY_BASS[c]), pump2('C2', 'C3', 'Bb1', 'Bb2')),
      },
    },
    // Bell: a few stars in the intro, sparkles on the long notes, more stars after dark.
    {
      inst: 'bell',
      vol: 0.42,
      pan: -0.35,
      patterns: {
        intro: bars(
          '. . . . . . . . C6 . . . . . . .',
          REST,
          '. . . . . . . . A5 . . . . . . .',
          REST,
          '. . . . . . . . F6 . . . C6 . . .',
          REST,
          '. . . . . . . . D6 . . . . . . .',
          '. . . . . . . . E6 . . . G6 . . .',
        ),
        A: bars(
          REST,
          '. . . . C6 . . . . . . . A5 . . .',
          REST,
          '. . . . D6 . . . . . . . Bb5 . . .',
          REST,
          '. . . . D6 . . . . . . . Bb5 . . .',
          REST,
          '. . . . E6 . . . . . . . C6 . . .',
          REST,
          '. . . . C6 . . . . . . . F6 . . .',
          REST,
          '. . . . . . . . D6 . . . F6 . . .',
          REST,
          '. . . . A5 . . . . . . . C6 . . .',
          REST,
          '. . . . G5 . . . C6 . . . E6 . . .',
        ),
        B: bars(
          'D6 . . . . . . . . . . . A5 . . .',
          REST,
          '. . . . Bb5 . . . . . . . D6 . . .',
          REST,
          'G5 . . . . . . . Eb6 . . . . . . .',
          REST,
          'E6 . . . . . . . C#6 . . . A5 . . .',
          REST,
          'F6 . . . . . . . . . . . D6 . . .',
          REST,
          'D6 . . . . . . . F6 . . . . . . .',
          REST,
          'G5 . . . . . . . D6 . . . . . . .',
          'E6 . . . . . . . . . . . . . . .',
          'F#6 . . . . . . . D6 . . . A5 . . .',
          '. . . . D6 . . . F#6 . . . A6 . . .',
        ),
        C: bars('C6 . . . . . . . . . . . . . . .', 'D6 . . . . . . . . . . . . . . .', 'D6 . . . . . . . . . . . . . . .', 'E6 . . . . . . . . . . . . . . .', 'C6 . . . . . . . . . . . . . . .', 'D6 . . . . . . . . . . . . . . .', 'F6 . . . . . . . . . . . . . . .', 'E6 . . . . . . . D6 . . . . . . .'),
      },
    },
    // Drums: a kick on every beat once the flight takes off.
    {
      inst: 'drums',
      vol: 0.8,
      patterns: {
        intro: bars(REST, REST, SKY_HATS, SKY_HATS, SKY_BEAT, SKY_BEAT, SKY_BEAT, SKY_ROLL),
        A: bars(SKY_CRASH, ...rep(SKY_BEAT, 6), SKY_FILL, SKY_CRASH, ...rep(SKY_BEAT, 6), SKY_TOMS),
        B: bars(SKY_CRASH, ...rep(SKY_BEAT_B, 6), SKY_FILL, SKY_CRASH, ...rep(SKY_BEAT_B, 5), SKY_TOMS, SKY_ROLL),
        C: bars(SKY_CRASH, SKY_DRIVE, SKY_DRIVE, SKY_DRIVE, SKY_CRASH, SKY_DRIVE, SKY_DRIVE, SKY_FILL),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// m5-organ — D minor, 108 bpm, inside the Grand Organ
// ---------------------------------------------------------------------------------------------

/** Clock tick: a short, dry FM bell. */
const CLOCK_BELL: InstrumentDef = {
  kind: 'fm',
  env: { a: 0.001, d: 0.22, s: 0, r: 0.08 },
  vol: 0.24,
  fm: { ratio: 4.2, index: 2.2, decay: 0.07 },
  oneShot: true,
};

/** The anthem, bent: a slow glide between legato notes and a wide, seasick vibrato. */
const BENT: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.03, d: 0.4, s: 0.7, r: 0.35 },
  vol: 0.26,
  vibrato: { rate: 4.4, depth: 30, delay: 0.2 },
  glide: 0.3,
};

/** Its echo in the pipes: the same voice, duller. */
const BENT_ECHO: InstrumentDef = { ...BENT, filter: { type: 'lowpass', freq: 1100, q: 0.7 } };

/** Gear ostinato in 8ths: a b a c a b a around a pivot note p. */
function gear(a: string, p: string, b: string, c: string): string {
  return measures(`${a}/2 ${p}/2 ${b}/2 ${p}/2 ${c}/2 ${p}/2 ${b}/2 ${p}/2`);
}

const GEARS: Readonly<Record<string, string>> = {
  Dm: gear('D4', 'A3', 'F4', 'E4'),
  Bb: gear('D4', 'Bb3', 'F4', 'C4'),
  Gm: gear('D4', 'G3', 'Bb3', 'A3'),
  A7: gear('C#4', 'A3', 'E4', 'G4'),
  Eb: gear('Eb4', 'Bb3', 'G4', 'F4'),
  C: gear('E4', 'C4', 'G4', 'D4'),
};

/** Clock: tick on beat 2, tock on beat 4 (`fast`: 8th ticks on the off-beats). */
function clock(tick: string, tock: string, fast = false): string {
  return fast ? measures(`./2 ${tick}_2 ./2 ${tock}_2 ./2 ${tick}_2 ./2 ${tock}_2`) : measures(`./4 ${tick}_8 ${tock}_4`);
}

const ORGAN_VOICINGS: Readonly<Record<string, string>> = {
  Dm: 'D4+F4+A4',
  'Bb/D': 'D4+F4+Bb4',
  Bb: 'D4+F4+Bb4',
  'Gm/D': 'D4+G4+Bb4',
  Gm: 'D4+G4+Bb4',
  'A7/D': 'C#4+E4+G4',
  A7: 'C#4+E4+G4+A4',
  'Eb/D': 'Eb4+G4+Bb4',
  Eb: 'Eb4+G4+Bb4',
  C: 'C4+E4+G4',
  A: 'C#4+E4+A4',
};

const ORGAN_A = ['Dm', 'Dm', 'Bb/D', 'Bb/D', 'Gm/D', 'Gm/D', 'A7/D', 'A7/D', 'Dm', 'Dm', 'Eb/D', 'Eb/D', 'Gm/D', 'Gm/D', 'A7', 'A7'];
const ORGAN_B = ['Bb', 'Bb', 'Gm', 'Gm', 'Eb', 'Eb', 'A7', 'A7', 'Dm', 'C', 'Bb', 'A', 'Gm', 'Eb', 'A7', 'A7'];

/** The anthem's fragments, bent (D minor: the anthem's first notes are D5 A5 F5 E5 B♭5 G5). */
const BENT_A = measures(
  './16 | ./16 | D5/4 ~A5/6 F5/6 | -/4 E5/12 | ./16 | ./16 | E5/8 ~Eb5/8 | ~D5/4 C#5/8 ./4 |' +
    './16 | ./16 | F5/4 G5/4 ~A5/8 | ~Ab5/12 ./4 | Bb5/6 A5/2 G5/4 F5/4 | ~E5/8 ./8 | ./16 | ./16',
);
const BENT_B = measures(
  'D5/6 E5/2 F5/4 ~G5/4 | ~A5/12 ./4 | ./16 | ./16 | G5/4 ~Bb5/4 G5/4 F5/4 | ~Eb5/12 ./4 | E5/8 ~Eb5/4 ~D5/4 | C#5/12 ./4 |' +
    'A5/8 G5/8 | ~G5/4 F5/4 E5/8 | F5/8 ~D5/8 | ~C#5/12 ./4 | Bb4/8 D5/8 | G5/12 ~F5/4 | ~E5/12 ./4 | ./16',
);

const ORGAN_BEAT = 'K . h:2 . . . h:2 . K . h:2 . . . h:2 .';
const ORGAN_STEAM = 'K . h:2 . . . h:2 . K . h:2 . o:4 . h:2 .';
const ORGAN_CLANK = 'K . h:2 . . . h:2 t:5 K . h:2 . . . r r:6';
const ORGAN_TURN = 'K . h:2 . . . h:2 . K . r:5 r:6 R . t:6 T';

const M5_ORGAN: SongDef = {
  bpm: 108,
  rowsPerBeat: 4,
  // Mix level: the sustained organ is dense; this brings it to about −20.5 dB RMS.
  vol: 0.67,
  order: ['A', 'B'],
  loop: 0,
  channels: [
    // Organ drones with a tremulant (A: over a D pedal; B: the pedal moves).
    ...organ(SWELL_ORGAN, { A: chordBars(ORGAN_A.map((c) => ORGAN_VOICINGS[c])), B: chordBars(ORGAN_B.map((c) => ORGAN_VOICINGS[c])) }, 0.85, -0.1),
    // Pedal.
    ...organ(
      PEDAL,
      {
        A: measures('D2/16 | -/16 | -/16 | -/16 | -/16 | -/16 | -/16 | -/16 | D2/16 | -/16 | -/16 | -/16 | -/16 | -/16 | A1/16 | -/16'),
        B: measures('Bb1/16 | -/16 | G1/16 | -/16 | Eb2/16 | -/16 | A1/16 | -/16 | D2/16 | C2/16 | Bb1/16 | A1/16 | G1/16 | Eb2/16 | A1/16 | -/16'),
      },
      0.9,
    ),
    // Triangle: the gears, in 8ths.
    {
      inst: 'triangle',
      vol: 0.7,
      pan: 0.3,
      patterns: {
        A: bars(...['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A7', 'A7', 'Dm', 'Dm', 'Eb', 'Eb', 'Gm', 'Gm', 'A7', 'A7'].map((c) => GEARS[c])),
        B: bars(...['Bb', 'Bb', 'Gm', 'Gm', 'Eb', 'Eb', 'A7', 'A7', 'Dm', 'C', 'Bb', 'A7', 'Gm', 'Eb', 'A7', 'A7'].map((c) => GEARS[c])),
      },
    },
    // Bell: the clock (it runs faster in the second half of B).
    {
      inst: CLOCK_BELL,
      vol: 0.8,
      pan: -0.35,
      patterns: {
        A: bars(...rep(clock('D6', 'A5'), 10), clock('Eb6', 'Bb5'), clock('Eb6', 'Bb5'), ...rep(clock('D6', 'A5'), 2), ...rep(clock('E6', 'A5'), 2)),
        B: bars(
          ...rep(clock('D6', 'F5'), 4),
          clock('Eb6', 'Bb5'),
          clock('Eb6', 'Bb5'),
          clock('E6', 'A5'),
          clock('E6', 'A5'),
          clock('D6', 'A5', true),
          clock('E6', 'G5', true),
          clock('D6', 'F5', true),
          clock('E6', 'A5', true),
          clock('D6', 'G5', true),
          clock('Eb6', 'Bb5', true),
          clock('E6', 'A5', true),
          clock('E6', 'A5', true),
        ),
      },
    },
    // The anthem, bent out of shape …
    { inst: BENT, vol: 0.85, pan: 0.15, patterns: { A: BENT_A, B: BENT_B } },
    // … and its echo in the pipes.
    { inst: BENT_ECHO, vol: 0.32, pan: -0.45, patterns: { A: delay(BENT_A, 3), B: delay(BENT_B, 3) } },
    // Drums: a heavy kick on 1 and 3, steam and clanks.
    {
      inst: 'drums',
      vol: 0.85,
      patterns: {
        A: bars(ORGAN_BEAT, ORGAN_BEAT, ORGAN_BEAT, ORGAN_STEAM, ORGAN_BEAT, ORGAN_BEAT, ORGAN_BEAT, ORGAN_CLANK, ORGAN_BEAT, ORGAN_BEAT, ORGAN_BEAT, ORGAN_STEAM, ORGAN_BEAT, ORGAN_BEAT, ORGAN_CLANK, ORGAN_TURN),
        B: bars(ORGAN_BEAT, ORGAN_BEAT, ORGAN_BEAT, ORGAN_STEAM, ORGAN_BEAT, ORGAN_BEAT, ORGAN_CLANK, ORGAN_TURN, ...rep(ORGAN_CLANK, 3), ORGAN_STEAM, ORGAN_CLANK, ORGAN_CLANK, ORGAN_STEAM, ORGAN_TURN),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// mini-boss — E minor, 150 bpm, urgent and cheeky
// ---------------------------------------------------------------------------------------------

const MB_BASS: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.002, d: 0.09, s: 0.4, r: 0.03 },
  vol: 0.27,
  filter: { type: 'lowpass', freq: 880, q: 3, env: 3 },
};

/** Staccato square for stabs and the taunt. */
const MB_STAB: InstrumentDef = { kind: 'pulse', duty: 0.5, env: { a: 0.002, d: 0.08, s: 0.22, r: 0.04 }, vol: 0.21 };

/** The 2-bar ostinato: syncopated octaves, the flat 7th and a cheeky B♭ → B. */
const MB_OSTINATO = bars('E2 . E3 E2 . E2 D3 . E2 . E3 . Bb2 . B2 .', 'E2 . E3 E2 . E2 D3 . G2 . A2 . Bb2 . B2 D3');

/** Two bars of chord stabs on the off-beats. */
function mbStabs(c1: string, c2 = c1): string {
  return measures(`./2 ${c1}_3 ${c1}_5 ${c1}_2 ${c1}_4 | ./2 ${c2}_3 ${c2}_3 ${c2}_3 ${c2}_3 ${c2}_2`);
}

/** The taunt (3+3+2 rhythm) and its two endings: a bent blue note, then a shrug down to B. */
const MB_TAUNT = measures('E5_3 G5_3 E5_2 A5_3 G5_3 E5_2 | Bb5/2 ~B5/2 ./4 D6_2 B5_2 A5_2 G5_2');
const MB_TAUNT_END = measures('E5_3 G5_3 E5_2 A5_3 G5_3 E5_2 | D5_2 E5_2 G5_2 E5_2 D5_3 B4_5');

const MB_GROOVE = 'K . h . S . h k . k h . S . h .';
const MB_GROOVE2 = 'K . h . S . h k . k h . S . S S';
const MB_CRASH = 'K+c . h . S . h k . k h . S . h .';
const MB_ROLL = 'K . s s S . s s S s S s S S S S';
const MB_ROLL_LONG = 's:5 s:5 s:6 s:6 s:7 s:7 s s S S S S S S S S';

const MINI_BOSS: SongDef = {
  bpm: 150,
  rowsPerBeat: 4,
  // 2 bars per slot: E minor stabs, the taunt, stabs, the taunt's answer, the same in A minor,
  // a cheeky climb C → D and a B7 turnaround with a long snare roll.
  order: ['A', 'B', 'A', 'C', 'Am', 'Bm', 'D', 'E'],
  loop: 0,
  channels: [
    {
      inst: MB_STAB,
      vol: 0.9,
      pan: 0.15,
      patterns: {
        A: mbStabs('E4+G4+B4'),
        B: MB_TAUNT,
        C: MB_TAUNT_END,
        Am: mbStabs('E4+A4+C5'),
        Bm: transpose(MB_TAUNT, -7),
        D: mbStabs('E4+G4+C5', 'F#4+A4+D5'),
        E: measures('./2 D#4+F#4+A4_3 D#4+F#4+A4_5 D#4+F#4+A4_2 D#4+F#4+A4_4 | D#4+F#4+B4_4 D#4+F#4+B4_4 D#4+F#4+A4_2 D#4+F#4+A4_2 D#4+F#4+A4_2 D#4+F#4+A4_2'),
      },
    },
    {
      inst: MB_BASS,
      vol: 0.95,
      patterns: {
        A: MB_OSTINATO,
        B: MB_OSTINATO,
        C: MB_OSTINATO,
        Am: transpose(MB_OSTINATO, 5),
        Bm: transpose(MB_OSTINATO, 5),
        D: bars('C2 . C3 C2 . C2 Bb2 . C2 . C3 . G2 . C3 .', 'D2 . D3 D2 . D2 C3 . D2 . D3 . A2 . D3 .'),
        E: bars('B1 . B2 B1 . B1 A2 . B1 . B2 . A2 . F#2 .', 'B1 . B2 B1 . B1 A2 . B1 B1 B2 B1 A2 A2 F#2 D#2'),
      },
    },
    {
      inst: 'bell',
      vol: 0.5,
      pan: -0.3,
      patterns: {
        A: bars('E6 . . . . . . . . . . . . . . .', '. . . . . . . . . . . . B5 . . .'),
        B: bars(REST, '. . . . . . . . . . . . . . E6 .'),
        C: bars(REST, '. . . . . . . . B5 . . . E6 . . .'),
        Am: bars('A5 . . . . . . . . . . . . . . .', '. . . . . . . . . . . . E6 . . .'),
        Bm: bars(REST, '. . . . . . . . . . . . . . A5 .'),
        D: bars('G6 . . . . . . . . . . . E6 . . .', 'A6 . . . . . . . . . . . F#6 . . .'),
        E: bars('B5 . . . . . . . . . . . B5 . . .', 'D#6 . . . D#6 . . . F#6 . . . A6 . . .'),
      },
    },
    {
      inst: 'drums',
      vol: 0.8,
      patterns: {
        A: bars(MB_CRASH, MB_GROOVE2),
        B: bars(MB_GROOVE, MB_GROOVE2),
        C: bars(MB_GROOVE, MB_ROLL),
        Am: bars(MB_CRASH, MB_GROOVE2),
        Bm: bars(MB_GROOVE, MB_ROLL),
        D: bars(MB_CRASH, MB_GROOVE2),
        E: bars(MB_GROOVE, MB_ROLL_LONG),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// boss-final — C minor, 168 bpm (intro 8 → A 16 → B 16 → C 16 anthem → loop to A)
// ---------------------------------------------------------------------------------------------

/** Lead: a bright 25 % pulse for fast lines. */
const FINAL_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.004, d: 0.2, s: 0.7, r: 0.1 },
  vol: 0.3,
  vibrato: { rate: 6.2, depth: 12, delay: 0.2 },
};

/** Counterpoint: a thin 12.5 % pulse. */
const FINAL_COUNTER: InstrumentDef = { kind: 'pulse', duty: 0.125, env: { a: 0.003, d: 0.14, s: 0.6, r: 0.07 }, vol: 0.34 };

/** The anthem's own voice: a pompous 50 % pulse with a wide vibrato … */
const ANTHEM_HORN: InstrumentDef = {
  kind: 'pulse',
  duty: 0.5,
  env: { a: 0.02, d: 0.3, s: 0.85, r: 0.2 },
  vol: 0.2,
  vibrato: { rate: 5, depth: 20, delay: 0.25 },
};

/** … doubled an octave down by a saw. */
const ANTHEM_SAW: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.02, d: 0.3, s: 0.8, r: 0.2 },
  vol: 0.17,
  filter: { type: 'lowpass', freq: 1800, q: 1, env: 1.4 },
};

/** Organ voicings (the stops add the octaves). */
const FV: Readonly<Record<string, string>> = {
  Cm: 'G3+C4+Eb4',
  CmHi: 'G3+C4+Eb4+G4',
  G: 'G3+B3+D4',
  G7: 'G3+B3+D4+F4',
  Ab: 'Ab3+C4+Eb4',
  Db: 'Ab3+Db4+F4',
  Eb: 'G3+Bb3+Eb4',
  Fm: 'F3+Ab3+C4',
  Fm7: 'F3+Ab3+C4+Eb4',
  Bb: 'F3+Bb3+D4',
  Ddim: 'F3+Ab3+D4',
};

/** Organ chords re-struck every half bar: one chord, or two (`a|b`). */
function strikes(list: readonly string[]): string {
  return measures(
    list
      .map((c) => {
        const [a, b] = c.split('|');
        return `${FV[a]}/7 ./1 ${FV[b ?? a]}/7 ./1`;
      })
      .join(' | '),
  );
}

/** Saw bass: octave 8ths on one root per bar, or two (`a|b`). */
const FB: Readonly<Record<string, [string, string]>> = {
  Cm: ['C2', 'C3'],
  CmHi: ['C2', 'C3'],
  G: ['G1', 'G2'],
  G7: ['G1', 'G2'],
  Ab: ['Ab1', 'Ab2'],
  Db: ['Db2', 'Db3'],
  Eb: ['Eb2', 'Eb3'],
  Fm: ['F1', 'F2'],
  Fm7: ['F1', 'F2'],
  Bb: ['Bb1', 'Bb2'],
  Ddim: ['D2', 'D3'],
};

function finalBass(list: readonly string[]): string {
  return bars(
    ...list.map((c) => {
      const [a, b] = c.split('|');
      const [l1, h1] = FB[a];
      const [l2, h2] = FB[b ?? a];
      return pump2(l1, h1, l2, h2);
    }),
  );
}

/** Repeated 8ths on one note per chord (the heartbeat under the fight). */
const HEART: Readonly<Record<string, string>> = { Cm: 'G4', CmHi: 'G4', G: 'D4', G7: 'D4', Ab: 'Eb4', Db: 'F4', Eb: 'Bb3', Fm: 'C4', Fm7: 'C4', Bb: 'F4', Ddim: 'F4' };

function heartbeat(list: readonly string[]): string {
  return measures(
    list
      .map((c) => {
        const [a, b] = c.split('|');
        const n1 = HEART[a];
        const n2 = HEART[b ?? a];
        return `${n1}_2 ${n1}_2 ${n1}_2 ${n1}_2 ${n2}_2 ${n2}_2 ${n2}_2 ${n2}_2`;
      })
      .join(' | '),
  );
}

const FINAL_A_CHORDS = ['Cm', 'Cm|G', 'Ab', 'Db|Eb', 'Fm', 'G', 'Cm', 'G', 'Cm', 'Cm', 'Ab', 'Bb', 'Eb', 'Ab', 'Fm|G', 'G'];
const FINAL_B_CHORDS = ['Ab', 'Bb', 'Eb', 'Cm', 'Ab', 'Bb', 'G', 'G', 'Fm', 'G', 'Eb', 'Ab', 'Fm', 'Ddim', 'G', 'G7'];
/** The anthem in C minor (two bars per anthem bar); bar 3 holds E♭ against the wrong D. */
const FINAL_C_CHORDS = ['Cm', 'Ddim', 'CmHi', 'G', 'Ab', 'Cm|Fm', 'Eb', 'G', 'Ab', 'Fm7', 'G7', 'Cm|G', 'Cm', 'Fm|G7', 'CmHi', 'Cm|G7'];

/** 16th arpeggio cells for the counterpoint in B. */
const RUNS: Readonly<Record<string, string>> = {
  Ab: 'Ab4 C5 Eb5 Ab5 Eb5 C5 Ab4 Eb4',
  Bb: 'Bb4 D5 F5 Bb5 F5 D5 Bb4 F4',
  Eb: 'Eb4 G4 Bb4 Eb5 Bb4 G4 Eb4 Bb3',
  Cm: 'C5 Eb5 G5 C6 G5 Eb5 C5 G4',
  G: 'G4 B4 D5 G5 D5 B4 G4 D4',
  Fm: 'F4 Ab4 C5 F5 C5 Ab4 F4 C4',
  Ddim: 'D5 F5 Ab5 D6 Ab5 F5 D5 Ab4',
};

const FINAL_LEAD_A = measures(
  'C5/2 Eb5/2 G5/2 C6/4 B5/2 C6/2 G5/2 | Ab5/2 G5/2 F5/2 Eb5/2 D5/4 G4/4 | Ab4/2 C5/2 Eb5/2 Ab5/4 G5/2 Ab5/2 Eb5/2 | F5/2 Eb5/2 Db5/2 C5/2 Bb4/4 Ab4/4 |' +
    'F4/2 Ab4/2 C5/2 F5/4 E5/2 F5/2 C5/2 | D5/2 F5/2 Ab5/2 G5/6 F5/2 D5/2 | Eb5/6 D5/2 C5/4 G4/4 | B4/2 C5/2 D5/2 Eb5/2 F5/2 G5/2 Ab5/2 B5/2 |' +
    'C6/8 G5/4 Eb5/4 | Ab5/6 G5/2 F5/4 Eb5/4 | C6/8 Ab5/4 Eb5/4 | D6/6 C6/2 Bb5/4 F5/4 |' +
    'Eb6/8 Bb5/4 G5/4 | Ab5/6 G5/2 F5/4 Eb5/4 | C5/4 F5/4 D5/4 G5/4 | Ab5/2 G5/2 F5/2 Eb5/2 D5/2 C5/2 B4/2 G4/2',
);

const FINAL_LEAD_B = measures(
  'Eb5/12 C5/4 | D5/12 Bb4/4 | G5/12 Eb5/4 | G5/8 Ab5/4 G5/4 | C6/12 Ab5/4 | Bb5/12 F5/4 | B5/16 | D6/8 B5/4 G5/4 |' +
    'C6/12 Ab5/4 | B5/12 G5/4 | Bb5/12 G5/4 | C6/8 Eb6/8 | F6/12 C6/4 | Ab5/12 F5/4 | G5/16 | ./16',
);

/** The anthem in C minor at half speed (= its own 84 bpm), the 7th note still a semitone flat. */
const FINAL_ANTHEM = stretch(anthemLine({ transpose: 2, minor: true }), 2);

const FINAL_BEAT = 'K . h . S . h . K . h k S . h .';
const FINAL_DRIVE = 'K . h k S . h . K . h k S . h k';
const FINAL_FILL = 'K . h . S . h . s s S s S S S S';
const FINAL_POMP = 'm:6 . h . h . h . S . h . h . h .';
const FINAL_POMP_ROLL = 'm:7 . h . h . h . S . m:3 . m:4 m:4 m:5 m:5';
/** Four bars under one anthem phrase: a crash on the first, a timpani roll into the next. */
const POMP_PHRASE = [`c+${FINAL_POMP}`, FINAL_POMP, FINAL_POMP, FINAL_POMP_ROLL];

const BOSS_FINAL: SongDef = {
  bpm: 168,
  rowsPerBeat: 4,
  // Mix level: about −19.5 dB RMS (a touch above the other bosses), peak below 0.7.
  vol: 0.75,
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    // Lead (pulse25): silent in the intro, the desperate main theme, pompous long notes.
    { inst: FINAL_LEAD, vol: 0.95, pan: 0.1, patterns: { A: FINAL_LEAD_A, B: FINAL_LEAD_B } },
    // Counterpoint (pulse12): contrary motion, broken chords, 16th runs, panicked fills.
    {
      inst: FINAL_COUNTER,
      vol: 0.5,
      pan: -0.3,
      patterns: {
        A: measures(
          'G4/8 Eb4/8 | Eb4/8 D4/8 | Eb4/8 C4/8 | Db4/8 Eb4/8 | C4/8 Ab3/8 | B3/8 D4/8 | C4/8 Eb4/8 | D4/16 |' +
            'Eb4/4 G4/4 C5/4 G4/4 | C5/4 B4/4 C5/4 G4/4 | Eb4/4 Ab4/4 C5/4 Ab4/4 | D4/4 F4/4 Bb4/4 F4/4 | Eb4/4 G4/4 Bb4/4 G4/4 | C4/4 Eb4/4 Ab4/4 Eb4/4 | Ab4/4 C5/4 B4/4 D5/4 | B4/8 D5/8',
        ),
        B: `${bars(...['Ab', 'Bb', 'Eb', 'Cm', 'Ab', 'Bb', 'G', 'G', 'Fm', 'G', 'Eb', 'Ab', 'Fm', 'Ddim', 'G'].map((c) => twice(RUNS[c])))} ${bars(
          'G4 Ab4 B4 C5 D5 Eb5 F5 G5 Ab5 G5 F5 Eb5 D5 C5 B4 G4',
        )}`,
        C: measures(
          './16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./8 G4 Ab4 B4 C5 D5 Eb5 F5 G5 |' +
            './16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./16 | ./8 G5 F5 Eb5 D5 C5 B4 C5 D5',
        ),
      },
    },
    // The anthem quote: pulse50 doubled by a saw an octave down.
    { inst: ANTHEM_HORN, vol: 0.95, pan: 0.05, patterns: { C: FINAL_ANTHEM } },
    { inst: ANTHEM_SAW, vol: 0.75, pan: -0.05, patterns: { C: transpose(FINAL_ANTHEM, -12) } },
    // Full organ: held chords and a toccata of arpeggios in the intro, struck chords in A,
    // big held chords in B and C.
    ...organ(
      FULL_ORGAN,
      {
        intro: `${vel(measures('C4+Eb4+G4+C5/16 | C4+Eb4+G4+B4/16 | C4+Eb4+G4+Bb4/16 | C4+F4+A4/8 C4+F4+Ab4/8'), 6)} ${bars(
          twice('C4 Eb4 G4 C5 Eb5 C5 G4 Eb4'),
          twice('C4 Eb4 Ab4 C5 Eb5 C5 Ab4 Eb4'),
          twice('D4 F4 Ab4 D5 F5 D5 Ab4 F4'),
          twice('B3 D4 F4 G4 B4 G4 F4 D4'),
        )}`,
        A: strikes(FINAL_A_CHORDS),
        B: chordBars(FINAL_B_CHORDS.map((c) => FV[c])),
        C: vel(
          measures(
            FINAL_C_CHORDS.map((c) => {
              const [a, b] = c.split('|');
              return b ? `${FV[a]}/8 ${FV[b]}/8` : `${a === 'CmHi' ? 'C4+G4+C5+Eb5' : FV[a]}/16`;
            }).join(' | '),
          ),
          6,
        ),
      },
      0.8,
      0.15,
    ),
    // Pedal: the descending line under the organ alone, long roots under the anthem.
    ...organ(
      FULL_PEDAL,
      {
        intro: vel(measures('C2/16 | -/16 | -/16 | -/16 | C2/16 | Ab1/16 | D2/16 | G1/16'), 7),
        C: vel(measures('C2/16 | D2/16 | C2/16 | G1/16 | Ab1/16 | C2/8 F1/8 | Eb2/16 | G1/16 | Ab1/16 | F1/16 | G1/16 | C2/8 G1/8 | C2/16 | F1/12 G1/4 | C2/16 | C2/8 G1/8'), 6),
      },
      0.8,
    ),
    // Saw bass: octave 8ths from the toccata on.
    {
      inst: DRIVE_BASS,
      vol: 0.9,
      patterns: {
        intro: `${bars(REST, REST, REST, REST)} ${finalBass(['Cm', 'Ab', 'Ddim', 'G'])}`,
        A: finalBass(FINAL_A_CHORDS),
        B: finalBass(FINAL_B_CHORDS),
        C: finalBass(FINAL_C_CHORDS),
      },
    },
    // Triangle: the heartbeat (repeated 8ths) in A and C, the lead an octave down in B.
    {
      inst: 'triangle',
      vol: 0.55,
      pan: 0.3,
      patterns: { A: heartbeat(FINAL_A_CHORDS), B: transpose(FINAL_LEAD_B, -12), C: heartbeat(FINAL_C_CHORDS) },
    },
    // Drums: timpani rolls under the organ, then everything; half-time pomp under the anthem.
    {
      inst: 'drums',
      vol: 0.82,
      kit: KIT,
      patterns: {
        intro: bars(
          'm:8 . . . . . . . . . . . . . . .',
          'm:6 . . . . . . . m:3 . m:3 . m:4 . m:5 .',
          'm:8 . . . . . . . . . . . . . . .',
          'm:3 . m:3 . m:3 . m:4 . m:4 . m:5 . m:5 m:5 m:6 m:6',
          'K+c . h . S . h . K . h k S . h .',
          FINAL_BEAT,
          FINAL_BEAT,
          'K . s s S . s s S s S s S S S S',
        ),
        A: bars('K+c . h . S . h . K . h k S . h .', ...rep(FINAL_BEAT, 6), FINAL_FILL, 'K+c . h k S . h . K . h k S . h k', ...rep(FINAL_DRIVE, 6), FINAL_FILL),
        B: bars('k+c+m:5 . h . S . h . K . h . S . h .', ...rep(FINAL_BEAT, 2), 'k+m:5 . h . S . h . K . h k S . h .', 'k+c+m:5 . h . S . h . K . h . S . h .', FINAL_BEAT, 'k+m:5 . h . S . h . K . h k S . h .', FINAL_FILL, 'k+c+m:5 . h . S . h . K . h . S . h .', ...rep(FINAL_DRIVE, 6), 'K . s s S . s s S s S s S S S S'),
        C: bars(...POMP_PHRASE, ...POMP_PHRASE, ...POMP_PHRASE, `c+${FINAL_POMP}`, FINAL_POMP, FINAL_POMP, 'm:7 . s s S . s s S s S s S S S S'),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// boss-final-fast — C minor, 200 bpm: Tempo! (its own song; A → B → loop)
// ---------------------------------------------------------------------------------------------

const FAST_A_CHORDS = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Db|Eb', 'G'];
/** The anthem rushed through (one anthem bar per bar): the same harmony as boss-final's C. */
const FAST_B_CHORDS = ['Cm|Ddim', 'CmHi|G', 'Ab|Fm', 'Eb|G', 'Ab|Fm7', 'G7|Cm', 'Cm|G7', 'Cm|G7'];

const FAST_LEAD_A = measures(
  'C5 Eb5 G5 C6 B5 C6 G5 Eb5 C5 Eb5 G5 C6 B5 C6 G5 Eb5 | Ab4 C5 Eb5 Ab5 G5 Ab5 Eb5 C5 Ab4 C5 Eb5 Ab5 G5 Ab5 Eb5 C5 |' +
    'F4 Ab4 C5 F5 E5 F5 C5 Ab4 F4 Ab4 C5 F5 E5 F5 C5 Ab4 | G4 B4 D5 G5 F#5 G5 D5 B4 G5/2 F5/2 Eb5/2 D5/2 |' +
    'Eb6/3 D6 C6/3 G5 Eb6/3 D6 C6/2 B5/2 | C6/3 Bb5 Ab5/3 Eb5 C6/3 Bb5 Ab5/2 G5/2 | F5/2 Ab5/2 Db6/2 Ab5/2 G5/2 Bb5/2 Eb6/2 Bb5/2 | B5/2 D6/2 B5/2 G5/2 F5/2 D5/2 B4/2 D5/2',
);

/** Organ stabs on every beat: one chord per bar or two (`a|b`). */
function beatStabs(list: readonly string[]): string {
  return measures(
    list
      .map((c) => {
        const [a, b] = c.split('|');
        const x = a === 'CmHi' ? 'C4+G4+C5+Eb5' : FV[a];
        const y = b === undefined ? x : b === 'CmHi' ? 'C4+G4+C5+Eb5' : FV[b];
        return `${x}/3 ./1 ${x}/3 ./1 ${y}/3 ./1 ${y}/3 ./1`;
      })
      .join(' | '),
  );
}

/** Panicked trill: two notes alternating in 16ths for a bar. */
const trill = (a: string, b: string): string => Array.from({ length: 8 }, () => `${a} ${b}`).join(' ');

const FAST_GALLOP = 'K h S h K h S h K h S h K h S h';
const FAST_GALLOP_K = 'K h S h K h S k K h S h K k S S';
const FAST_TICKS = 'K+c+r h S h K+r h S h K+r h S h K+r h S h';

const BOSS_FINAL_FAST: SongDef = {
  bpm: 200,
  rowsPerBeat: 4,
  // Mix level: the same loudness as boss-final, so the Tempo! crossfade does not jump.
  vol: 0.71,
  order: ['A', 'B'],
  loop: 0,
  channels: [
    { inst: FINAL_LEAD, vol: 0.9, pan: 0.1, patterns: { A: FAST_LEAD_A } },
    {
      inst: FINAL_COUNTER,
      vol: 0.45,
      pan: -0.3,
      patterns: {
        A: measures('G4/8 Ab4/8 | Ab4/8 G4/8 | F4/8 Ab4/8 | G4/8 B4/8 | C5/8 B4/8 | C5/8 Eb5/8 | F5/8 G5/8 | B4/16'),
        B: bars(trill('C5', 'B4'), trill('D5', 'Eb5'), trill('C5', 'D5'), trill('Bb4', 'B4'), trill('C5', 'Db5'), trill('B4', 'C5'), trill('Eb5', 'D5'), trill('B4', 'D5')),
      },
    },
    { inst: ANTHEM_HORN, vol: 0.95, pan: 0.05, patterns: { B: anthemLine({ transpose: 2, minor: true }) } },
    { inst: ANTHEM_SAW, vol: 0.75, pan: -0.05, patterns: { B: transpose(anthemLine({ transpose: 2, minor: true }), -12) } },
    ...organ(FULL_ORGAN, { A: beatStabs(FAST_A_CHORDS), B: beatStabs(FAST_B_CHORDS) }, 0.7, 0.15),
    { inst: DRIVE_BASS, vol: 0.9, patterns: { A: finalBass(FAST_A_CHORDS), B: finalBass(FAST_B_CHORDS) } },
    {
      inst: 'drums',
      vol: 0.8,
      kit: KIT,
      patterns: {
        A: bars(FAST_TICKS, FAST_GALLOP, FAST_GALLOP, FAST_GALLOP_K, 'K+c h S h K h S h K h S h K h S h', FAST_GALLOP, FAST_GALLOP, 'K s S s K s S s S s S s S S S S'),
        B: bars('k+c+m:5 h S h K h S h K h S h K h S h', FAST_GALLOP, FAST_GALLOP, FAST_GALLOP_K, 'K+c h S h K h S h K h S h K h S h', FAST_GALLOP, FAST_GALLOP, 's s S s S s S s S S S S m:6 m:7 m:7 m:8'),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// ending — D major, 116 bpm, the parade (32 bars, plays once; then `credits`)
// ---------------------------------------------------------------------------------------------

/** March brass: a round 50 % pulse for the fanfare and the harmony in thirds. */
const BRASS: InstrumentDef = { kind: 'pulse', duty: 0.5, env: { a: 0.01, d: 0.2, s: 0.7, r: 0.1 }, vol: 0.17 };

/** Tuba: the "oom" on beats 1 and 3. */
const TUBA: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.012, d: 0.16, s: 0.55, r: 0.06 },
  vol: 0.26,
  filter: { type: 'lowpass', freq: 650, q: 1.2, env: 1.8 },
};

/** Fanfaroni's triangle: an inharmonic FM ring. */
const TRIANGLE_DING: InstrumentDef = {
  kind: 'fm',
  env: { a: 0.001, d: 1.6, s: 0, r: 0.6 },
  vol: 0.3,
  fm: { ratio: 3.17, index: 1.6, decay: 0.9 },
  oneShot: true,
};

const MARCH_VOICINGS: Readonly<Record<string, string>> = {
  D: 'D4+F#4+A4',
  G: 'D4+G4+B4',
  Em: 'E4+G4+B4',
  A: 'C#4+E4+A4',
  A7: 'C#4+E4+G4',
  Asus: 'D4+E4+A4',
  Bm: 'D4+F#4+B4',
  Bm7: 'D4+F#4+A4+B4',
};

/** The "pah": chords on beats 2 and 4 (one chord per bar, or `a|b` for two). */
function afterbeats(list: readonly string[]): string {
  return measures(
    list
      .map((c) => {
        const [a, b] = c.split('|');
        return `./4 ${MARCH_VOICINGS[a]}_4 ./4 ${MARCH_VOICINGS[b ?? a]}_4`;
      })
      .join(' | '),
  );
}

const TUBA_ROOTS: Readonly<Record<string, [string, string]>> = {
  D: ['D2', 'A1'],
  G: ['G1', 'D2'],
  Em: ['E2', 'B1'],
  A: ['A1', 'E2'],
  A7: ['A1', 'E2'],
  Asus: ['A1', 'E2'],
  Bm: ['B1', 'F#2'],
  Bm7: ['B1', 'F#2'],
};

/** The "oom": root on beat 1, fifth on beat 3 (or the roots of `a|b`). */
function oom(list: readonly string[]): string {
  return measures(
    list
      .map((c) => {
        const [a, b] = c.split('|');
        const one = TUBA_ROOTS[a][0];
        const three = b === undefined ? TUBA_ROOTS[a][1] : TUBA_ROOTS[b][0];
        return `${one}/3 ./5 ${three}/3 ./5`;
      })
      .join(' | '),
  );
}

const END_HOOK_CHORDS = ['D', 'G', 'Em', 'A', 'D', 'G', 'Bm', 'A'];
const END_TRIO_CHORDS = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'A'];
/** Grandioso: chords that carry the hook and the anthem at once. */
const END_GRAND_CHORDS = ['D|Em', 'D|A7', 'Em|G', 'A', 'D', 'Em|A', 'Bm7', 'Asus'];

/** The hook for the grandioso: bar 6 ends on C♯5 A4 (instead of D5 B4) to sit on A. */
const END_GRAND_HOOK = [CYGNET_HOOK, CYGNET_ANSWER, measures('F#4/4 D5/10 F#5 G5 | A5/3 G5 F#5/3 E5 C#5/3 A4/5'), CYGNET_CLOSE].join(' ');

const MARCH = 'K . s:5 . S . s:5 s:5 K . s:5 . S . s s';
const MARCH_C = 'K+c . s:5 . S . s:5 s:5 K . s:5 . S . s s';
const MARCH_SOFT = 'k . h . s:4 . h . k . h . s:4 . h .';
const MARCH_ROLL = 'K . s s S . s s S s S s S S S S';
const LONG_ROLL = 's:4 s:4 s:5 s:5 s:5 s:6 s:6 s:6 s:7 s:7 s s S S S S';

const ENDING: SongDef = {
  bpm: 116,
  rowsPerBeat: 4,
  order: ['intro', 'A', 'T', 'G', 'coda'],
  loop: null,
  channels: [
    // Lead: the swan's voice — the hook, the title's counter-melody, the hook again, resolved.
    {
      inst: SWAN_LEAD,
      vol: 1,
      pan: 0.05,
      patterns: {
        A: CYGNET_THEME,
        T: measures(
          'B4/2 C#5/2 D5/2 F#5/2 E5/2 D5/2 C#5/2 B4/2 | D5/4 B4/2 G4/2 A4/2 B4/2 D5/4 | A4/2 F#4/2 A4/2 D5/2 F#5/4 E5/2 D5/2 | C#5/4 A4/4 E5/8 |' +
            'F#5/2 E5/2 D5/2 C#5/2 D5/2 B4/4 F#4/2 | G4/2 A4/2 B4/2 D5/2 G5/4 F#5/2 E5/2 | E5/4 G5/4 F#5/2 E5/2 D5/2 B4/2 | C#5/8 E5/4 A4/4',
        ),
        G: END_GRAND_HOOK,
        coda: measures('F#4/4 D5/12 | E5/3 D5 B4/3 C#5 E5/4 C#5/4 | D5/16 | D5/3 ./13'),
      },
    },
    // Brass: the fanfare, thirds and sixths under the hook, guide tones in the trio.
    {
      inst: BRASS,
      vol: 0.8,
      pan: -0.25,
      patterns: {
        intro: measures('A4/2 D5/2 F#5/2 A5/6 F#5/2 A5/2 | B5/6 A5/2 G5/4 B5/4 | A5/6 F#5/2 D5/4 F#5/4 | E5/8 A4/8'),
        A: measures(
          'D4/4 F#4/12 | C5/3 B4 G4/3 F#4 D4/6 ./2 | E4/4 G4/12 | A4/3 C#5 A4/3 G#4 C#4/6 ./2 |' +
            'D4/4 F#4/10 A4 B4 | E5/3 D5 D5/3 C5 B4/3 G4/5 | B4/3 A4 F#4/3 F#4 D4/4 F#4/4 | C#4/12 ./4',
        ),
        T: vel(measures('F#5/16 | G5/12 ./4 | A5/16 | E5/12 ./4 | D5/16 | D5/8 B4/8 | G5/12 ./4 | A5/8 E5/4 ./4'), 6),
        G: measures(
          'D4/4 A4/4 B4/8 | A4/3 F#4 D4/4 C#4/6 ./2 | E4/4 B4/12 | A4/3 C#5 A4/3 G#4 C#4/6 ./2 |' +
            'D4/4 F#4/10 A4 B4 | E5/4 B4/3 C#5 A4/3 E4/5 | B4/3 A4 F#4/3 F#4 D4/4 F#4/4 | A3/12 ./4',
        ),
        coda: measures('D4/4 F#4/12 | C5/3 B4 G4/3 A4 C#5/4 A4/4 | F#4+A4/16 | F#4+A4/3 ./13'),
      },
    },
    // Bell: sparkles in the trio; in the grandioso the anthem as a counter-line — finally in
    // tune, except its one wrong note (the 7th: F instead of F♯).
    {
      inst: 'bell',
      vol: 0.5,
      pan: 0.3,
      patterns: {
        T: bars(
          'B5 . . . . . F#5 . . . . . D6 . . .',
          'G5 . . . . . D5 . . . . . B5 . . .',
          'A5 . . . . . F#5 . . . . . D6 . . .',
          'E5 . . . . . C#5 . . . . . A5 . . .',
          'B5 . . . . . F#5 . . . . . D6 . . .',
          'G5 . . . . . D5 . . . . . B5 . . .',
          'E5 . . . . . B4 . . . . . G5 . . .',
          'A5 . . . C#6 . . . E6 . . . . . . .',
        ),
        G: anthemLine({ transpose: 4 }),
        coda: bars(REST, REST, 'D6 . . . . . . . . . . . . . . .', REST),
      },
    },
    // The "pah": afterbeat chords.
    {
      inst: STAB,
      vol: 0.75,
      pan: 0.2,
      patterns: {
        intro: afterbeats(['D', 'G', 'D', 'A']),
        A: afterbeats(END_HOOK_CHORDS),
        T: vel(afterbeats(END_TRIO_CHORDS), 5),
        G: afterbeats(END_GRAND_CHORDS),
        coda: measures(`./4 ${MARCH_VOICINGS.D}_4 ./4 ${MARCH_VOICINGS.D}_4 | ./4 ${MARCH_VOICINGS.G}_4 ./4 ${MARCH_VOICINGS.A7}_4 | D4+F#4+A4+D5/16 | D4+F#4+A4+D5/3 ./13`),
      },
    },
    // Tuba: the "oom".
    {
      inst: TUBA,
      vol: 0.95,
      patterns: {
        intro: oom(['D', 'G', 'D', 'A']),
        A: oom(END_HOOK_CHORDS),
        T: oom(END_TRIO_CHORDS),
        G: oom(END_GRAND_CHORDS),
        coda: measures('D2/3 ./5 A1/3 ./5 | G1/3 ./5 A1/3 ./5 | D2/16 | D2/3 ./13'),
      },
    },
    // Fanfaroni's one note: after the last chord, at the wrong time.
    { inst: TRIANGLE_DING, vol: 0.9, pan: 0.4, patterns: { coda: measures('./16 | ./16 | ./16 | ./10 A6 ./5') } },
    // Drums: a march (snare cadence, bass drum on 1 and 3, cymbals), timpani for the last chord.
    {
      inst: 'drums',
      vol: 0.8,
      kit: KIT,
      patterns: {
        intro: bars(MARCH_C, MARCH, MARCH, LONG_ROLL),
        A: bars(MARCH_C, ...rep(MARCH, 6), MARCH_ROLL),
        T: bars(MARCH_SOFT, MARCH_SOFT, MARCH_SOFT, MARCH_SOFT, MARCH_SOFT, MARCH_SOFT, MARCH_SOFT, LONG_ROLL),
        G: bars(MARCH_C, MARCH, MARCH_C, MARCH, MARCH_C, MARCH, MARCH_C, MARCH_ROLL),
        coda: bars(MARCH_C, MARCH_ROLL, 'C+m:4 . m:3 . m:3 . m:4 . m:4 . m:5 . m:5 m:5 m:6 m:6', 'k+c+m:6 . . . . . . . . . . . . . . .'),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// credits — G major, 100 bpm, swing (3 rows per beat: triplet 8ths, 12 rows per bar)
// ---------------------------------------------------------------------------------------------

/** Rows per 4/4 bar on the triplet grid. */
const SWING_BAR = 12;

/** A soft electric piano for the comping (FM, ratio 1). */
const KEYS: InstrumentDef = { kind: 'fm', env: { a: 0.004, d: 0.5, s: 0.35, r: 0.18 }, vol: 0.13, fm: { ratio: 1, index: 1.4, decay: 0.35 } };

const swing = (s: string): string => measures(s, SWING_BAR);

/** The title hook in G, swung: the dotted walk down becomes long-short triplets. */
const CREDITS_A = swing('B3/3 G4/9 | A4/2 G4 E4/2 D4 C4/5 . | C4/3 A4/9 | B4/2 A4 F#4/2 E4 D4/5 . | B3/3 G4/7 B4 C5 | D5/2 C5 B4/2 A4 G4/2 E4/4 | G4/2 F#4 E4/2 D4 B3/3 D4/3 | A3/9 ./3');
/** Second time: laid back, a triplet pickup, and the title's alternative ending. */
const CREDITS_A2 = swing('. B3/2 G4/9 | A4/2 G4 E4/2 D4 C4/5 . | C4/3 A4/9 | B4/2 A4 F#4/2 E4 D4/5 . | B3/3 G4/6 B4 C5 D5 | E5/2 D5 C5/2 B4 A4/2 F#4/4 | G4/2 F#4 E4/2 D4 E4/2 G4 A4/3 | B4/3 A4/3 F#4/3 D4/2 .');
/** The bridge: the title's counter-melody, swung. */
const CREDITS_B = swing(
  'E4/2 F#4 G4/2 B4 A4/2 G4 F#4/2 E4 | G4/3 E4/2 C4 D4/2 E4 G4/3 | D4/2 B3 D4/2 G4 B4/3 A4/2 G4 | F#4/3 D4/3 A4/6 |' +
    'B4/2 A4 G4/2 F#4 G4/2 E4/3 B3 | C4/2 D4 E4/2 G4 C5/3 B4/2 A4 | A4/3 C5/3 B4/2 A4 G4/2 E4 | F#4/6 A4/3 D4/3',
);

const CREDITS_A_CHORDS = ['Gmaj7', 'Cmaj7', 'Am7', 'D7', 'Gmaj7', 'Cmaj7', 'Em7', 'D7'];
const CREDITS_B_CHORDS = ['Em7', 'Cmaj7', 'Gmaj7', 'D7', 'Em7', 'Cmaj7', 'Am7', 'D7'];

const KEYS_VOICINGS: Readonly<Record<string, string>> = {
  Gmaj7: 'F#3+B3+D4',
  Cmaj7: 'E3+G3+B3',
  Am7: 'G3+C4+E4',
  D7: 'F#3+C4+E4',
  Em7: 'G3+B3+D4',
};

/** Comping: on 1 and on the swung "and" of 2 (the Charleston), varied every other bar. */
function comp(list: readonly string[]): string {
  return swing(list.map((c, i) => (i % 2 === 0 ? `${KEYS_VOICINGS[c]}/2 ./3 ${KEYS_VOICINGS[c]}/2 ./5` : `./3 ${KEYS_VOICINGS[c]}/2 ./4 ${KEYS_VOICINGS[c]}/3`)).join(' | '));
}

/** Walking bass in quarter notes (3 rows each). */
const WALK_A = swing('G2/3 B2/3 D3/3 B2/3 | C3/3 B2/3 A2/3 G#2/3 | A2/3 C3/3 E3/3 Eb3/3 | D3/3 C3/3 A2/3 F#2/3 | G2/3 D3/3 G2/3 B2/3 | C3/3 D3/3 E3/3 D#3/3 | E3/3 D3/3 B2/3 C#3/3 | D3/3 A2/3 F#2/3 A2/3');
const WALK_B = swing('E2/3 F#2/3 G2/3 B2/3 | C3/3 E3/3 B2/3 A2/3 | G2/3 B2/3 D3/3 C#3/3 | D3/3 A2/3 F#2/3 D#2/3 | E2/3 B2/3 G2/3 B2/3 | C3/3 G2/3 E2/3 G#2/3 | A2/3 C3/3 E3/3 C#3/3 | D3/3 C3/3 A2/3 F#2/3');

const BRUSH = 'w+d . . b+d . d w+d . . b+d . d';
const BRUSH_K = 'k:3+w+d . . b+d . d w+d . . b+d . d';
const BRUSH_FILL = 'w+d . . b+d . d w+d . b b+d b b';

const CREDITS: SongDef = {
  bpm: 100,
  rowsPerBeat: 3,
  // Mix level: relaxed, about −21 dB RMS.
  vol: 0.72,
  order: ['A', 'A2', 'B', 'A3'],
  loop: 0,
  channels: [
    // The swan sings the title theme (the last A an octave up).
    {
      inst: SWAN_LEAD,
      vol: 0.95,
      pan: 0.05,
      patterns: { A: CREDITS_A, A2: CREDITS_A2, B: CREDITS_B, A3: vel(transpose(CREDITS_A, 12), 7) },
    },
    { inst: KEYS, vol: 0.8, pan: -0.25, patterns: { A: comp(CREDITS_A_CHORDS), A2: comp(CREDITS_A_CHORDS), B: comp(CREDITS_B_CHORDS), A3: comp(CREDITS_A_CHORDS) } },
    { inst: 'triangle', vol: 1, patterns: { A: WALK_A, A2: WALK_A, B: WALK_B, A3: WALK_A } },
    {
      inst: 'drums',
      vol: 0.7,
      kit: KIT,
      patterns: {
        A: barsOfSwing(BRUSH_K, BRUSH, BRUSH, BRUSH, BRUSH_K, BRUSH, BRUSH, BRUSH_FILL),
        A2: barsOfSwing(BRUSH_K, BRUSH, BRUSH, BRUSH, BRUSH_K, BRUSH, BRUSH, BRUSH_FILL),
        B: barsOfSwing(BRUSH_K, BRUSH, BRUSH, BRUSH, BRUSH_K, BRUSH, BRUSH, BRUSH_FILL),
        A3: barsOfSwing(BRUSH_K, BRUSH, BRUSH, BRUSH, BRUSH_K, BRUSH, BRUSH, BRUSH_FILL),
      },
    },
  ],
};

/** Bars of the triplet grid (12 rows each). */
function barsOfSwing(...list: string[]): string {
  return measures(list.join(' | '), SWING_BAR);
}

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** Every song of this module by id (tests parse them). */
export const FINALE_SONGS: Readonly<Record<string, SongDef>> = {
  'm5-sky': M5_SKY,
  'm5-organ': M5_ORGAN,
  'mini-boss': MINI_BOSS,
  'boss-final': BOSS_FINAL,
  'boss-final-fast': BOSS_FINAL_FAST,
  ending: ENDING,
  credits: CREDITS,
};

for (const [id, song] of Object.entries(FINALE_SONGS)) defineSong(id, song);
