/**
 * Content category "music": original tracker songs (docs/api/media.md §9.2,
 * docs/GAME_DESIGN.md §12.2). Registers at import time.
 *
 * Every note here was composed for METAL SWAN 3 (docs/ORIGINALITY.md): no melody, bass line or
 * arrangement is taken from any existing tune.
 *
 * - `title` — "calm on top, furious underneath": a slow, gliding lead (the Cygnet hook: a wide
 *   leap up, a dotted walk down, an open ending) over a racing 16th-note saw bass (the paddling).
 *   D major, 112 bpm. intro 8 (pad + bell) → A 16 → B 8 (triangle counter-melody) → A′ 8 →
 *   loop to A (loop 68.6 s).
 * - `m0` — the test range: a driving E-minor action loop, 150 bpm.
 *   intro 2 → A 8 (riff) → B 8 (soaring lift) → C 4 (stab break) → loop to A (≈ 32 s).
 * - `boss` — A minor, 156 bpm: a jabbing riff with quick runs (three-note cells: a triplet feel),
 *   long defiant notes, a half-time breakdown. intro 4 (snare roll) → A 16 → B 16 → C 8 → loop
 *   to A (loop 61.5 s).
 * - `continue` — a nervous clock figure, one per countdown number, each a semitone higher
 *   (a 2-bar loop transposed up per pass; 12 s before it goes round).
 * - `game-over` (once, 5 s) — a deflated D-minor fall that lands on a sour C♯ against D minor
 *   (the anthem's wrong note: the anthem wins).
 * - `mission-complete` (once, 6 s) — the Cygnet hook as a short D-major fanfare, ending with a honk.
 *
 * Shared with the other song modules (`missions.ts`, `finale.ts`):
 * - helpers: `bars` / `barsOf` / `measures` (bar-checked pattern strings), `mel` (melody
 *   shorthand: `C5/3` = held 3 rows, `C5_3` = 1 row + 2 rests), `rep`, `REST`, `rest`, `held`,
 *   `transpose`, `noteName`, `run16`, `pump`, `KIT` (extra drum letters);
 * - instruments: `SWAN_LEAD`, `PADDLE_BASS`, `DRIVE_BASS`, `ACTION_LEAD`, `STAB`, `ORGAN`;
 * - leitmotifs (GDD §12.2): `CYGNET_HOOK` + `CYGNET_ANSWER` (D major) and the anthem:
 *   `ANTHEM_THEME`, `ANTHEM_WRONG_NOTE`, `anthemLine()` (B♭ major; its 7th note is a semitone flat).
 *
 * Patterns are written one bar (16 rows = 16th notes) per string; `bars()` joins them and
 * checks the row count, so a typo fails loudly in the tests instead of shifting the song.
 */
import { defineSong } from '../../../engine/audio';
import { noteToMidi, patternRows } from '../../../engine/music';
import type { InstrumentDef, SongDef } from '../../../engine/music';

/** Rows per bar at 4 rows per beat in 4/4. */
export const BAR = 16;

/** Join one-bar pattern strings, each exactly `rowsPerBar` rows long (6/8 at 3 rows per beat: 6). */
export function barsOf(rowsPerBar: number, ...list: string[]): string {
  list.forEach((b, i) => {
    const n = patternRows(b).length;
    if (n !== rowsPerBar) throw new Error(`music: bar ${i} has ${n} rows, expected ${rowsPerBar}: "${b}"`);
  });
  return list.join(' | ');
}

/** Join one-bar pattern strings (each must have exactly 16 rows). */
export function bars(...list: string[]): string {
  return barsOf(BAR, ...list);
}

/**
 * Melody shorthand → pattern rows. A token is any pattern token (`C5`, `F#4!`, `~E4`, `C4+E4`,
 * `k`, `K+h`, `.`, `-`) with an optional length: `X/n` = X held for n rows (legato),
 * `X_n` = X for one row, then n − 1 rests (staccato). `./n` and `-/n` are n rests / holds.
 */
export function mel(s: string): string {
  const out: string[] = [];
  for (const tok of s.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = /^(.+?)([/_])(\d+)$/.exec(tok);
    if (!m) {
      out.push(tok);
      continue;
    }
    const n = Number(m[3]);
    if (!(n >= 1)) throw new Error(`music: bad length in "${tok}"`);
    const fill = m[1] === '.' || (m[2] === '_' && m[1] !== '-') ? '.' : '-';
    out.push(m[1]);
    for (let i = 1; i < n; i++) out.push(fill);
  }
  return out.join(' ');
}

/** Several bars in melody shorthand, separated by '|'; every bar is checked for `rowsPerBar` rows. */
export function measures(s: string, rowsPerBar = BAR): string {
  const list = s
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map(mel);
  return barsOf(rowsPerBar, ...list);
}

/** Repeat one bar (or any pattern) n times. */
export function rep(bar: string, n: number): string[] {
  return Array.from({ length: n }, () => bar);
}

/** n rows of rest. */
export function rest(rows: number): string {
  return Array.from({ length: rows }, () => '.').join(' ');
}

/** A whole bar of rest. */
export const REST = rest(BAR);

/** One token held for `rows` rows (a whole-bar chord: `held('D4+F#4+A4', 16)`). */
export function held(token: string, rows = BAR): string {
  return mel(`${token}/${rows}`);
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** MIDI note → pattern note name (60 → 'C4', 70 → 'Bb4'). */
export function noteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Transpose every note of a melodic pattern by `semis` semitones (drum letters are an error). */
export function transpose(pattern: string, semis: number): string {
  if (semis === 0) return pattern;
  return pattern
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((tok) => {
      if (tok === '.' || tok === '-' || tok === '|') return tok;
      return tok
        .split('+')
        .map((part) => {
          const m = /^(~?)([A-Ga-g][#b]?\d)(!|:[1-9])?$/.exec(part);
          const midi = m ? noteToMidi(m[2]) : null;
          if (!m || midi === null) throw new Error(`music: cannot transpose "${part}"`);
          return `${m[1]}${noteName(midi + semis)}${m[3] ?? ''}`;
        })
        .join('+');
    })
    .join(' ');
}

/** Semitones above the tonic of the major scale (rotate it for modes: dorian = from index 1). */
export const MAJOR: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

/**
 * A parallel harmony line: every note of a melodic pattern moved `steps` scale steps inside the
 * scale on `tonic` (pitch class 0–11; −2 = a diatonic third below, −5 = a sixth below). A note
 * outside the scale moves by the nearest interval of that size that lands in the scale.
 */
export function harmonize(pattern: string, tonic: number, steps: number, scale: readonly number[] = MAJOR): string {
  const inScale = (m: number): boolean => scale.includes((((m - tonic) % 12) + 12) % 12);
  const dir = Math.sign(steps);
  const approx = (steps * 12) / 7;
  const move = (m: number): number => {
    if (!inScale(m)) {
      for (const c of [Math.trunc(approx), Math.trunc(approx) + dir]) if (inScale(m + c)) return m + c;
      return m + Math.round(approx);
    }
    let r = m;
    for (let k = 0; k < Math.abs(steps); k++) {
      r += dir;
      while (!inScale(r)) r += dir;
    }
    return r;
  };
  return pattern
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((tok) => {
      if (tok === '.' || tok === '-' || tok === '|') return tok;
      return tok
        .split('+')
        .map((part) => {
          const m = /^(~?)([A-Ga-g][#b]?\d)(!|:[1-9])?$/.exec(part);
          const midi = m ? noteToMidi(m[2]) : null;
          if (!m || midi === null) throw new Error(`music: cannot harmonize "${part}"`);
          return `${m[1]}${noteName(move(midi))}${m[3] ?? ''}`;
        })
        .join('+');
    })
    .join(' ');
}

/**
 * Extra drum letters for a channel `kit` (the engine registers the sounds): b brush tap,
 * w brush sweep, z shaker, d ride cymbal, m timpani. The default letters (k s h o c t p r) stay.
 */
export const KIT: Readonly<Record<string, string>> = {
  b: 'drum/brush',
  w: 'drum/swish',
  z: 'drum/shaker',
  d: 'drum/ride',
  m: 'drum/timpani',
};

// ---------------------------------------------------------------------------------------------
// Instruments (custom variants of the engine presets)
// ---------------------------------------------------------------------------------------------

/** Legato pulse lead with a delayed vibrato and a short glide: the swan gliding. */
export const SWAN_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.012, d: 0.3, s: 0.72, r: 0.16 },
  vol: 0.3,
  vibrato: { rate: 5.2, depth: 14, delay: 0.28 },
  glide: 0.035,
};

/** Plucky saw bass for running 16ths (the filter opens on every note). */
export const PADDLE_BASS: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.002, d: 0.09, s: 0.45, r: 0.03 },
  vol: 0.26,
  filter: { type: 'lowpass', freq: 820, q: 2.2, env: 3 },
};

/** Punchier octave bass for the action loop. */
export const DRIVE_BASS: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.002, d: 0.12, s: 0.55, r: 0.04 },
  vol: 0.27,
  filter: { type: 'lowpass', freq: 1100, q: 2.5, env: 2.6 },
};

/** Bright, slightly nasal action lead. */
export const ACTION_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.004, d: 0.18, s: 0.62, r: 0.08 },
  vol: 0.36,
  vibrato: { rate: 6, depth: 10, delay: 0.18 },
};

/** Short brass-like stab for chords on the off-beats. */
export const STAB: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.004, d: 0.12, s: 0.25, r: 0.06 },
  vol: 0.17,
  detune: 10,
  filter: { type: 'lowpass', freq: 2400, q: 1.2, env: 1.6 },
};

/** Church-organ pad: three barely detuned saws, a quick swell, full sustain (anthem, organ). */
export const ORGAN: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.05, d: 0.3, s: 0.9, r: 0.3 },
  vol: 0.13,
  detune: 5,
  filter: { type: 'lowpass', freq: 1900, q: 0.7 },
};

// ---------------------------------------------------------------------------------------------
// Leitmotifs (GDD §12.2)
// ---------------------------------------------------------------------------------------------

/**
 * The Cygnet hook (the heroes), 2 bars in D major: a wide leap up (F♯4 → D5), a dotted walk
 * down, an open ending on G4. Always answer it with a busy bass (`run16`). Other keys: `transpose`.
 */
export const CYGNET_HOOK = measures('F#4/4 D5/12 | E5/3 D5 B4/3 A4 G4/6 ./2');

/** The hook's answer (the next 2 bars of `title`): the same gesture a step higher, ending on A4. */
export const CYGNET_ANSWER = measures('G4/4 E5/12 | F#5/3 E5 C#5/3 B4 A4/6 ./2');

/**
 * The Anthem of Eternal Attention (the villain), in tune: 8 bars of 4/4 in B♭ major as
 * [note, rows] (16 rows per bar; '.' = rest). Pompous dotted leaps, a climb to the top B♭.
 * Use `anthemLine()`: it plays the 7th melody note (a D5 over B♭ major) one semitone flat.
 */
export const ANTHEM_THEME: readonly (readonly [string, number])[] = [
  ['Bb4', 3], ['F5', 1], ['D5', 4], ['C5', 3], ['G5', 1], ['Eb5', 4],
  ['D5', 8], ['C5', 6], ['A4', 2],
  ['Bb4', 6], ['C5', 2], ['D5', 4], ['Eb5', 4],
  ['F5', 12], ['.', 4],
  ['G5', 6], ['F5', 2], ['Eb5', 4], ['D5', 4],
  ['C5', 3], ['G5', 1], ['Eb5', 4], ['D5', 3], ['C5', 1], ['A4', 4],
  ['D5', 3], ['Eb5', 1], ['F5', 4], ['G5', 6], ['A5', 2],
  ['Bb5', 12], ['.', 4],
];

/** Index (counting notes, not rests) of the anthem's wrong note: the 7th melody note. */
export const ANTHEM_WRONG_NOTE = 6;

export interface AnthemOpts {
  /** Semitones (−12 = an octave down; +2 = C major). */
  transpose?: number;
  /** Minor: lowers the 3rd and 6th degrees (harmonic minor; the wrong note stays a semitone flat). */
  minor?: boolean;
  /** True plays the 7th note in tune (only the ending's last, wrong-time note may need this). */
  inTune?: boolean;
}

/** The anthem melody as a 128-row pattern string (8 bars of 16 rows). */
export function anthemLine(opts: AnthemOpts = {}): string {
  const t = opts.transpose ?? 0;
  const out: string[] = [];
  let n = 0;
  for (const [note, rows] of ANTHEM_THEME) {
    if (note === '.') {
      out.push(rest(rows));
      continue;
    }
    let midi = (noteToMidi(note) ?? 70) + t;
    // Degree above the tonic (B♭4 = MIDI 70): 4 = the 3rd, 9 = the 6th.
    const degree = (((midi - 70 - t) % 12) + 12) % 12;
    if (opts.minor && (degree === 4 || degree === 9)) midi -= 1;
    if (n === ANTHEM_WRONG_NOTE && !opts.inTune) midi -= 1;
    n++;
    out.push(held(noteName(midi), rows));
  }
  return out.join(' ');
}

// ---------------------------------------------------------------------------------------------
// title — D major, 112 bpm
// ---------------------------------------------------------------------------------------------

/**
 * Running 16th bass bar: root, octave, fifth, octave … with the last four rows walking toward
 * the next chord (`tail`).
 */
export function run16(root: string, oct: string, fifth: string, tail: [string, string, string, string]): string {
  const cell = `${root} ${oct} ${fifth} ${oct}`;
  return `${cell} ${cell} ${cell} ${tail.join(' ')}`;
}

const TITLE_BASS = {
  D: run16('D2', 'D3', 'A2', ['D2', 'D3', 'A2', 'C#3']),
  G: run16('G2', 'G3', 'D3', ['G2', 'G3', 'D3', 'F#3']),
  Em: run16('E2', 'E3', 'B2', ['E2', 'E3', 'B2', 'G2']),
  A: run16('A2', 'A3', 'E3', ['A2', 'G2', 'F#2', 'E2']),
  Bm: run16('B2', 'B3', 'F#3', ['B2', 'B3', 'F#3', 'A3']),
  // Bar 8 of B climbs back to the hook.
  Aup: run16('A2', 'A3', 'E3', ['A2', 'B2', 'C#3', 'E3']),
};

/** Held pad chords, one per bar. */
const PAD = {
  D: 'D4+F#4+A4 - - - - - - - - - - - - - - -',
  G: 'D4+G4+B4 - - - - - - - - - - - - - - -',
  Em: 'E4+G4+B4 - - - - - - - - - - - - - - -',
  A: 'C#4+E4+A4 - - - - - - - - - - - - - - -',
  Bm: 'D4+F#4+B4 - - - - - - - - - - - - - - -',
};

/** The hook phrase (bars 1–6 of A and A′): hook, answer, a climb and a walk down. */
const TITLE_HOOK_PHRASE = [
  'F#4 - - - D5 - - - - - - - - - - -',
  'E5 - - D5 B4 - - A4 G4 - - - - - . .',
  'G4 - - - E5 - - - - - - - - - - -',
  'F#5 - - E5 C#5 - - B4 A4 - - - - - . .',
  'F#4 - - - D5 - - - - - - - - - F#5 G5',
  'A5 - - G5 F#5 - - E5 D5 - - B4 - - - -',
];

/** Bell sparkles on the long notes of the hook phrase (A and A′). */
const TITLE_SPARKLE = [
  '. . . . D6 . . . . . . . A5 . . .',
  '. . . . . . . . G5 . B5 . D6 . . .',
  '. . . . E6 . . . . . . . B5 . . .',
  '. . . . . . . . A5 . C#6 . E6 . . .',
  '. . . . D6 . . . . . . . A5 . . .',
  '. . . . . . . . D6 . . . B5 . . .',
];

const TITLE_DRUM = 'k . h . s . h . k . h k s . h .';
const TITLE_DRUM_ROLL = 'k . h . s . h . k . h . s s s S';

const TITLE: SongDef = {
  bpm: 112,
  rowsPerBeat: 4,
  // GDD §12.2: intro 8 (pad + bell) → A 16 → B 8 → A′ 8 → loop to A.
  order: ['intro', 'A', 'B', 'A2'],
  loop: 1,
  channels: [
    // Lead: the Cygnet hook. A wide leap up, a dotted walk down, an open ending.
    {
      inst: SWAN_LEAD,
      vol: 1,
      pan: 0.05,
      patterns: {
        A: bars(
          ...TITLE_HOOK_PHRASE,
          'D5 - - C#5 B4 - - A4 F#4 - - - A4 - - -',
          'E4 - - - - - - - - - - - . . . .',
          // Second half: the hook leaps a sixth, the answer ends on the leading tone, a cadence home.
          'A4 - - - F#5 - - - - - - - - - - -',
          'G5 - - F#5 E5 - - D5 B4 - - - - - . .',
          'B4 - - - G5 - - - - - - - - - - -',
          'A5 - - G5 E5 - - D5 C#5 - - - - - . .',
          'D5 - - - B5 - - - - - - - A5 - - -',
          'G5 - - - - - - - F#5 - - E5 D5 - - -',
          'E5 - - - F#5 - - - G5 - - - A5 - - -',
          'D5 - - - - - - - - - - - . . . .',
        ),
        B: bars(
          // The lead holds high guide tones while the triangle sings the counter-melody.
          'F#5 - - - - - - - - - - - - - - -',
          'G5 - - - - - - - - - - - . . . .',
          'A5 - - - - - - - - - - - - - - -',
          'E5 - - - - - - - - - - - . . . .',
          'D5 - - - - - - - - - - - - - - -',
          'D5 - - - - - - - B4 - - - - - - -',
          'G5 - - - - - - - - - - - . . . .',
          'A5 - - - - - - - E5 - - - . . . .',
        ),
        A2: bars(...TITLE_HOOK_PHRASE, 'D5 - - C#5 B4 - - A4 B4 - - D5 E5 - - -', 'F#5 - - - E5 - - - C#5 - - - A4 - . .'),
      },
    },
    // Bell: arpeggios in the intro, sparkles on the long notes later.
    {
      inst: 'bell',
      vol: 0.55,
      pan: -0.25,
      patterns: {
        intro: bars(
          'D5 . F#5 . A5 . D6 . A5 . F#5 . A5 . D6 .',
          'B4 . D5 . F#5 . B5 . F#5 . D5 . F#5 . B5 .',
          'G4 . B4 . D5 . G5 . D5 . B4 . D5 . G5 .',
          'A4 . C#5 . E5 . A5 . E5 . C#5 . E5 . G5 .',
          // Bars 5–8: the same chords falling and rising again, the bass enters below.
          'D6 . A5 . F#5 . D5 . F#5 . A5 . D6 . F#6 .',
          'B5 . F#5 . D5 . B4 . D5 . F#5 . B5 . D6 .',
          'G5 . D5 . B4 . G4 . B4 . D5 . G5 . B5 .',
          'A5 . E5 . C#5 . A4 . C#5 . E5 . G5 . A5 .',
        ),
        A: bars(
          '. . . . D6 . . . . . . . A5 . . .',
          REST,
          '. . . . E6 . . . . . . . B5 . . .',
          REST,
          '. . . . D6 . . . . . . . A5 . . .',
          REST,
          REST,
          '. . . . . . . . E5 . A5 . C#6 . E6 .',
          '. . . . F#6 . . . . . . . D6 . . .',
          '. . . . . . . . G5 . B5 . D6 . . .',
          '. . . . G6 . . . . . . . E6 . . .',
          '. . . . . . . . A5 . C#6 . E6 . . .',
          '. . . . F#6 . . . . . . . D6 . . .',
          '. . . . . . . . D6 . . . B5 . . .',
          REST,
          '. . . . . . . . D6 . F#6 . A6 . . .',
        ),
        B: bars(
          'B5 . . . . . F#5 . . . . . D6 . . .',
          'G5 . . . . . D5 . . . . . B5 . . .',
          'A5 . . . . . F#5 . . . . . D6 . . .',
          'E5 . . . . . C#5 . . . . . A5 . . .',
          'B5 . . . . . F#5 . . . . . D6 . . .',
          'G5 . . . . . D5 . . . . . B5 . . .',
          'E5 . . . . . B4 . . . . . G5 . . .',
          'A5 . . . C#6 . . . E6 . . . . . . .',
        ),
        A2: bars(...TITLE_SPARKLE, REST, '. . . . . . . . E5 . A5 . C#6 . E6 .'),
      },
    },
    // Pad: held chords.
    {
      inst: 'pad',
      vol: 0.8,
      pan: 0.2,
      patterns: {
        intro: bars(PAD.D, PAD.Bm, PAD.G, PAD.A, PAD.D, PAD.Bm, PAD.G, PAD.A),
        A: bars(PAD.D, PAD.G, PAD.Em, PAD.A, PAD.D, PAD.G, PAD.Bm, PAD.A, PAD.D, PAD.G, PAD.Em, PAD.A, PAD.Bm, PAD.G, PAD.A, PAD.D),
        B: bars(PAD.Bm, PAD.G, PAD.D, PAD.A, PAD.Bm, PAD.G, PAD.Em, PAD.A),
        A2: bars(PAD.D, PAD.G, PAD.Em, PAD.A, PAD.D, PAD.G, PAD.Bm, PAD.A),
      },
    },
    // Bass: the paddling — racing 16ths under the calm melody (long notes from intro bar 5).
    {
      inst: PADDLE_BASS,
      vol: 0.9,
      patterns: {
        intro: bars(REST, REST, REST, REST, held('D2'), held('B1'), held('G1'), TITLE_BASS.Aup),
        A: bars(
          TITLE_BASS.D, TITLE_BASS.G, TITLE_BASS.Em, TITLE_BASS.A, TITLE_BASS.D, TITLE_BASS.G, TITLE_BASS.Bm, TITLE_BASS.A,
          TITLE_BASS.D, TITLE_BASS.G, TITLE_BASS.Em, TITLE_BASS.A, TITLE_BASS.Bm, TITLE_BASS.G, TITLE_BASS.Aup, TITLE_BASS.D,
        ),
        B: bars(TITLE_BASS.Bm, TITLE_BASS.G, TITLE_BASS.D, TITLE_BASS.A, TITLE_BASS.Bm, TITLE_BASS.G, TITLE_BASS.Em, TITLE_BASS.Aup),
        A2: bars(TITLE_BASS.D, TITLE_BASS.G, TITLE_BASS.Em, TITLE_BASS.A, TITLE_BASS.D, TITLE_BASS.G, TITLE_BASS.Bm, TITLE_BASS.Aup),
      },
    },
    // Triangle: the B-section counter-melody (flowing 8ths).
    {
      inst: 'triangle',
      vol: 0.9,
      pan: -0.1,
      patterns: {
        B: bars(
          'B4 - C#5 - D5 - F#5 - E5 - D5 - C#5 - B4 -',
          'D5 - - - B4 - G4 - A4 - B4 - D5 - - -',
          'A4 - F#4 - A4 - D5 - F#5 - - - E5 - D5 -',
          'C#5 - - - A4 - - - E5 - - - - - - -',
          'F#5 - E5 - D5 - C#5 - D5 - B4 - - - F#4 -',
          'G4 - A4 - B4 - D5 - G5 - - - F#5 - E5 -',
          'E5 - - - G5 - - - F#5 - E5 - D5 - B4 -',
          'C#5 - - - - - - - E5 - - - A4 - - -',
        ),
      },
    },
    // Drums: none in the intro (a soft hat count-in on its last bar), a steady pulse later.
    {
      inst: 'drums',
      vol: 0.75,
      patterns: {
        intro: bars(...rep(REST, 7), 'h . . . h . . . h . . . h . h h'),
        A: bars(
          'K . h . s . h . k . h k s . h .',
          TITLE_DRUM,
          TITLE_DRUM,
          TITLE_DRUM_ROLL,
          'K . h . s . h . k . h k s . h .',
          TITLE_DRUM,
          TITLE_DRUM,
          'k . h . s . h . k . s . s s S s',
          'C . h . s . h . k . h k s . h .',
          TITLE_DRUM,
          TITLE_DRUM,
          TITLE_DRUM_ROLL,
          'K . h . s . h . k . h k s . h .',
          TITLE_DRUM,
          TITLE_DRUM,
          'k . h . s . h . k . t . t t T t',
        ),
        B: bars(
          'C . h . s . h . k . h . s . h .',
          'k . h . s . h . k . h . s . o .',
          'k . h . s . h . k . h . s . h .',
          'k . h . s . h . k . h . s . o .',
          'k . h . s . h . k . h . s . h .',
          'k . h . s . h . k . h . s . o .',
          'k . h . s . h . k . h . s . h .',
          'k . h . s . h . k . t . t t T t',
        ),
        A2: bars(
          'C . h . s . h . k . h k s . h .',
          TITLE_DRUM,
          TITLE_DRUM,
          TITLE_DRUM_ROLL,
          'K . h . s . h . k . h k s . h .',
          TITLE_DRUM,
          TITLE_DRUM,
          'k . h . s . s . k . s s S s S S',
        ),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// m0 — E minor, 150 bpm
// ---------------------------------------------------------------------------------------------

/** Pumping 8th-note octave bass for one bar. */
export function pump(low: string, high: string, last?: string): string {
  const pair = `${low} . ${high} .`;
  return `${pair} ${pair} ${pair} ${last ? `${low} . ${last} .` : pair}`;
}

const M0_BASS = {
  Em: pump('E2', 'E3'),
  C: pump('C2', 'C3'),
  D: pump('D2', 'D3'),
  Bm: pump('B1', 'B2', 'A2'),
  Am: pump('A1', 'A2'),
  B: pump('B1', 'B2', 'D#3'),
};

/** Off-beat chord stabs. */
const STABS = {
  Em: '. . E4+G4+B4 . . . E4+G4+B4 . . . E4+G4+B4 . . E4+G4+B4 . .',
  C: '. . E4+G4+C5 . . . E4+G4+C5 . . . E4+G4+C5 . . E4+G4+C5 . .',
  D: '. . F#4+A4+D5 . . . F#4+A4+D5 . . . F#4+A4+D5 . . F#4+A4+D5 . .',
  B: '. . D#4+F#4+B4 . . . D#4+F#4+B4 . . . D#4+F#4+B4 . . D#4+F#4+B4 . .',
  Am: '. . E4+A4+C5 . . . E4+A4+C5 . . . E4+A4+C5 . . E4+A4+C5 . .',
};

const M0_DRUM_A = 'K . h . s . h k k . h . s . h h';
const M0_DRUM_B = 'K . h k S . h . K . h k S . h .';

const M0: SongDef = {
  bpm: 150,
  rowsPerBeat: 4,
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    // Lead: a syncopated riff (A) and a soaring long-note lift (B).
    {
      inst: ACTION_LEAD,
      vol: 0.9,
      pan: 0.1,
      patterns: {
        A: bars(
          'E5 - - B4 - - E5 - G5 - F#5 - E5 - D5 -',
          'E5 - - - - - - - . . G4 - A4 - B4 -',
          'D5 - - A4 - - D5 - F#5 - E5 - D5 - C5 -',
          'B4 - - - - - - - . . F#4 - G4 - A4 -',
          'E5 - - B4 - - E5 - G5 - F#5 - E5 - D5 -',
          'E5 - - - G5 - - - A5 - - G5 - - E5 -',
          'C6 - - B5 - - A5 - G5 - - E5 - - D5 -',
          'D#5 - - - - - - - F#5 - - - B5 - - -',
        ),
        B: bars(
          'G5 - - - - - - - E5 - - - G5 - - -',
          'A5 - - - - - - - F#5 - - - D5 - - -',
          'B5 - - - - - - - - - - - A5 - G5 -',
          'E5 - - - - - - - - - - - . . . .',
          'G5 - - - E5 - - - C6 - - - B5 - - -',
          'A5 - - - F#5 - - - D6 - - - C6 - - -',
          'B5 - - - - - - - A5 - - - F#5 - - -',
          'D#5 - - - - - - - . . . . . . . .',
        ),
        C: bars(REST, REST, REST, '. . . . . . . . B4 - D#5 - F#5 - A5 -'),
      },
    },
    // Harmony: a third below the lead in A, arpeggios under B.
    {
      inst: 'pulse25',
      vol: 0.55,
      pan: -0.3,
      patterns: {
        A: bars(
          'G4 - - G4 - - G4 - B4 - A4 - G4 - F#4 -',
          'G4 - - - - - - - . . E4 - F#4 - G4 -',
          'F#4 - - F#4 - - F#4 - A4 - G4 - F#4 - E4 -',
          'D4 - - - - - - - . . D4 - E4 - F#4 -',
          'G4 - - G4 - - G4 - B4 - A4 - G4 - F#4 -',
          'G4 - - - B4 - - - C5 - - B4 - - G4 -',
          'E5 - - D5 - - C5 - B4 - - G4 - - F#4 -',
          'B4 - - - - - - - D#5 - - - F#5 - - -',
        ),
        B: bars(
          'C5 . E5 . G5 . E5 . C5 . E5 . G5 . E5 .',
          'D5 . F#5 . A5 . F#5 . D5 . F#5 . A5 . F#5 .',
          'E5 . G5 . B5 . G5 . E5 . G5 . B5 . G5 .',
          'E5 . G5 . B5 . G5 . E5 . G5 . B5 . G5 .',
          'C5 . E5 . G5 . E5 . C5 . E5 . G5 . E5 .',
          'D5 . F#5 . A5 . F#5 . D5 . F#5 . A5 . F#5 .',
          'D#5 . F#5 . B5 . F#5 . D#5 . F#5 . B5 . F#5 .',
          'D#5 . F#5 . B5 . F#5 . D#5 . F#5 . A5 . F#5 .',
        ),
      },
    },
    // Stabs: off-beat chords in the break and under B.
    {
      inst: STAB,
      vol: 0.8,
      pan: 0.25,
      patterns: {
        B: bars(STABS.C, STABS.D, STABS.Em, STABS.Em, STABS.C, STABS.D, STABS.B, STABS.B),
        C: bars(STABS.Em, STABS.Em, STABS.C, STABS.B),
      },
    },
    // Bass: pumping octaves.
    {
      inst: DRIVE_BASS,
      vol: 0.95,
      patterns: {
        intro: bars(M0_BASS.Em, M0_BASS.Em),
        A: bars(M0_BASS.Em, M0_BASS.C, M0_BASS.D, M0_BASS.Bm, M0_BASS.Em, M0_BASS.C, M0_BASS.Am, M0_BASS.B),
        B: bars(M0_BASS.C, M0_BASS.D, M0_BASS.Em, M0_BASS.Em, M0_BASS.C, M0_BASS.D, M0_BASS.B, M0_BASS.B),
        C: bars(M0_BASS.Em, M0_BASS.Em, M0_BASS.C, M0_BASS.B),
      },
    },
    // Drums.
    {
      inst: 'drums',
      vol: 0.8,
      patterns: {
        intro: bars('K . h . s . h . k . h . s . h .', 'k . h . s . h . k k s . s s S S'),
        A: bars(...rep(M0_DRUM_A, 3), 'K . h . s . h k k . s . s s S s', ...rep(M0_DRUM_A, 3), 'k . s . s . s s S s S s S S S S'),
        B: bars('C . h k S . h . K . h k S . h .', ...rep(M0_DRUM_B, 2), 'K . h k S . h . k . t . t t T T', 'C . h k S . h . K . h k S . h .', ...rep(M0_DRUM_B, 2), 'K . s . s . s s S . S . S S S S'),
        C: bars('K . . . p . . . K . K . p . . .', 'K . . . p . . . K . K . p . p .', 'K . . . p . . . K . K . p . . .', 'K . s s S . s s S s S s C . . .'),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// boss — A minor, 156 bpm: fast, aggressive, a little silly
// ---------------------------------------------------------------------------------------------

const BOSS_BASS = {
  Am: pump('A1', 'A2'),
  F: pump('F1', 'F2'),
  G: pump('G1', 'G2'),
  E: pump('E1', 'E2', 'G#2'),
  Dm: pump('D2', 'D3'),
  /** Half-time breakdown: one long root per bar. */
  AmLong: held('A1'),
  FLong: held('F1'),
  DmLong: held('D2'),
  ELong: 'E1 - - - - - - - E2 - - - - - - -',
};

/** Bell hits on the downbeat (one per bar). */
const hit = (n: string): string => `${n} . . . . . . . . . . . . . . .`;

const BOSS_DRUM = 'K . h . S . h . k k h . S . h .';
const BOSS_ROLL = 'K . h . S . h . s s s s S S S S';
const BOSS_DRIVE = 'K . h k S . h . K . h k S . h k';
const BOSS_LAST = 'K . s s S . s s S s S s S S S S';
const BOSS_HALF = 'K . . . . . . . S . . . . . . .';
const BOSS_HALF_K = 'K . . . . . K . S . . . . . . .';

/** The riff (bars 1–2 of each half of A), with a sixth-below harmony. */
const BOSS_RIFF = ['E5 - - A5 - - G5 - E5 - D5 - C5 - - -', 'C5 - - F5 - - E5 - C5 - A4 - C5 - D5 -'];
const BOSS_RIFF_LOW = ['G4 - - C5 - - B4 - G4 - F4 - E4 - - -', 'E4 - - A4 - - G4 - E4 - C4 - E4 - F4 -'];

const BOSS: SongDef = {
  bpm: 156,
  rowsPerBeat: 4,
  // GDD §12.2: intro 4 (snare roll) → A 16 → B 16 → C 8 (half-time breakdown) → loop to A.
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    // Lead: a jabbing riff with quick runs (A; its second half runs in three-note cells, a
    // triplet feel across the beat), long defiant notes (B), a half-time call (C).
    {
      inst: 'pulse25',
      vol: 1,
      pan: 0.1,
      patterns: {
        A: bars(
          ...BOSS_RIFF,
          'B4 - - G5 - - F5 - D5 - B4 - G4 - A4 B4',
          'G#4 - - - B4 - - - E5 - - - D5 C5 B4 G#4',
          'A4 - - E5 - - A5 - - B5 - C6 B5 A5 G5 E5',
          'F5 - - E5 - - C5 - - A4 - C5 - F5 - -',
          'D5 - - F5 - - A5 - - G5 - F5 - E5 - D5',
          'E5 - - - - - - - G#5 - B5 - E6 - - -',
          ...BOSS_RIFF,
          'D5 - - B5 - - A5 - G5 - D5 - B4 - C5 D5',
          'E5 - - - G#5 - - - B5 - - - A5 G#5 F5 E5',
          'A5 G5 F5 A5 G5 F5 A5 G5 F5 C6 - - A5 - - -',
          'B5 A5 G5 B5 A5 G5 B5 A5 G5 D6 - - B5 - - -',
          'G#5 F5 E5 G#5 F5 E5 G#5 F5 E5 B5 - - G#5 - - -',
          'E6 - - - - - - - - - - - D6 C6 B5 G#5',
        ),
        B: bars(
          'A5 - - - - - - - G5 - - - F5 - - -',
          'G5 - - - - - - - F5 - - - D5 - - -',
          'E5 - - - - - - - - - - - C5 - D5 -',
          'E5 - - - A4 - - - C5 - - - E5 - - -',
          'F5 - - - - - - - E5 - - - D5 - - -',
          'B4 - - - - - - - G#4 - - - B4 - - -',
          'C5 - - - - - - - B4 - - - A4 - - -',
          'G#4 - - - B4 - - - E5 - G#5 - B5 - - -',
          // Second half: an octave higher and more desperate, runs at the phrase ends.
          'F5 - - - - - - - A5 - - - D6 - - -',
          'E6 - - - - - - - D6 - - - B5 - - -',
          'C6 - - - - - - - - - - - B5 - A5 -',
          'A5 - - - - - - - C6 B5 A5 C6 B5 A5 F5 -',
          'D6 - - - - - - - F6 - - - E6 - D6 -',
          'B5 - - - - - - - G#5 - - - E5 - - -',
          'A5 G5 F5 A5 G5 F5 C6 B5 A5 C6 B5 A5 F6 - - -',
          'E6 - - - - - - - - - - - . . . .',
        ),
        C: bars(
          'A4 - - - - - - - E5 - - - - - D5 -',
          'C5 - - - - - - - B4 - - - A4 - - -',
          'A4 - - - - - - - F5 - - - - - E5 -',
          'C5 - - - - - - - - - - - . . . .',
          'D5 - - - - - - - A5 - - - - - G5 -',
          'F5 - - - - - - - E5 - - - D5 - - -',
          'E5 - - - - - - - B4 - - - G#4 - B4 -',
          '. . . . E5 . E5 . E5 . E5 E5 E5 E5 E5 E5',
        ),
      },
    },
    // Harmony: a sixth below in the riff, thirds under the runs and the long notes.
    {
      inst: 'pulse12',
      vol: 0.5,
      pan: -0.3,
      patterns: {
        A: bars(
          ...BOSS_RIFF_LOW,
          'D4 - - B4 - - A4 - F4 - D4 - B3 - C4 D4',
          'B3 - - - E4 - - - G#4 - - - F4 E4 D4 B3',
          'C4 - - G4 - - C5 - - D5 - E5 D5 C5 B4 G4',
          'A4 - - G4 - - E4 - - C4 - E4 - A4 - -',
          'F4 - - A4 - - D5 - - B4 - A4 - G4 - F4',
          'G#4 - - - - - - - B4 - D5 - G#5 - - -',
          ...BOSS_RIFF_LOW,
          'F4 - - D5 - - C5 - B4 - F4 - D4 - E4 F4',
          'G#4 - - - B4 - - - E5 - - - C5 B4 A4 G#4',
          'F5 E5 C5 F5 E5 C5 F5 E5 C5 A5 - - F5 - - -',
          'G5 F5 D5 G5 F5 D5 G5 F5 D5 B5 - - G5 - - -',
          'E5 D5 B4 E5 D5 B4 E5 D5 B4 G#5 - - E5 - - -',
          'G#5 - - - - - - - - - - - B5 A5 G#5 E5',
        ),
        B: bars(
          'F5 - - - - - - - E5 - - - D5 - - -',
          'D5 - - - - - - - D5 - - - B4 - - -',
          'C5 - - - - - - - - - - - A4 - B4 -',
          'C5 - - - E4 - - - A4 - - - C5 - - -',
          'D5 - - - - - - - C5 - - - A4 - - -',
          'G#4 - - - - - - - E4 - - - G#4 - - -',
          'A4 - - - - - - - G#4 - - - E4 - - -',
          'E4 - - - G#4 - - - B4 - E5 - G#5 - - -',
          'D5 - - - - - - - F5 - - - A5 - - -',
          'B5 - - - - - - - B5 - - - G#5 - - -',
          'A5 - - - - - - - - - - - G#5 - E5 -',
          'F5 - - - - - - - A5 G5 F5 A5 G5 F5 C5 -',
          'A5 - - - - - - - D6 - - - C6 - B5 -',
          'G#5 - - - - - - - E5 - - - B4 - - -',
          'F5 E5 C5 F5 E5 C5 A5 G5 F5 A5 G5 F5 C6 - - -',
          'G#5 - - - - - - - - - - - . . . .',
        ),
      },
    },
    // Bell stabs on the downbeats (answers in the breakdown).
    {
      inst: 'bell',
      vol: 0.5,
      pan: 0.3,
      patterns: {
        intro: bars(hit('A5'), REST, hit('F5'), '. . . . . . . . E6 . . . E6 . E6 .'),
        A: bars(
          hit('A5'), hit('F5'), hit('G5'), hit('E5'), hit('A5'), hit('F5'), hit('D5'), hit('B5'),
          hit('A5'), hit('F5'), hit('B5'), hit('E5'), hit('C6'), hit('D6'), hit('B5'), hit('E6'),
        ),
        B: bars(
          hit('C6'), hit('B5'), hit('A5'), hit('E6'), hit('D6'), hit('B5'), hit('C6'), hit('B5'),
          hit('D6'), hit('E6'), hit('C6'), hit('A5'), hit('F6'), hit('E6'), hit('C6'), hit('B5'),
        ),
        C: bars(
          hit('A5'),
          '. . . . . . . . E6 . . . . . . .',
          hit('F5'),
          '. . . . . . . . C6 . A5 . F5 . . .',
          hit('D6'),
          '. . . . . . . . A5 . . . . . . .',
          hit('E6'),
          '. . . . . . . . E6 . . . E6 . E6 .',
        ),
      },
    },
    // Bass: octave 8ths; long roots in the intro and the breakdown.
    {
      inst: DRIVE_BASS,
      vol: 0.95,
      patterns: {
        intro: bars(BOSS_BASS.AmLong, BOSS_BASS.AmLong, BOSS_BASS.FLong, BOSS_BASS.ELong),
        A: bars(
          BOSS_BASS.Am, BOSS_BASS.F, BOSS_BASS.G, BOSS_BASS.E, BOSS_BASS.Am, BOSS_BASS.F, BOSS_BASS.Dm, BOSS_BASS.E,
          BOSS_BASS.Am, BOSS_BASS.F, BOSS_BASS.G, BOSS_BASS.E, BOSS_BASS.F, BOSS_BASS.G, BOSS_BASS.E, BOSS_BASS.E,
        ),
        B: bars(
          BOSS_BASS.F, BOSS_BASS.G, BOSS_BASS.Am, BOSS_BASS.Am, BOSS_BASS.Dm, BOSS_BASS.E, BOSS_BASS.Am, BOSS_BASS.E,
          BOSS_BASS.Dm, BOSS_BASS.E, BOSS_BASS.Am, BOSS_BASS.F, BOSS_BASS.Dm, BOSS_BASS.E, BOSS_BASS.F, BOSS_BASS.E,
        ),
        C: bars(
          BOSS_BASS.AmLong, BOSS_BASS.AmLong, BOSS_BASS.FLong, BOSS_BASS.FLong,
          BOSS_BASS.DmLong, BOSS_BASS.DmLong, held('E1'), BOSS_BASS.ELong,
        ),
      },
    },
    // Drums: a snare-roll intro (crescendo), rolls before phrase ends, a half-time breakdown.
    {
      inst: 'drums',
      vol: 0.8,
      patterns: {
        intro: bars(
          's:3 . . . s:3 . . . s:4 . . . s:4 . s:4 .',
          's:4 . s:4 . s:5 . s:5 . s:5 . s:5 . s:6 s:5 s:6 s:6',
          's:6 s:5 s:6 s:5 s:6 s:6 s:7 s:6 s:7 s:6 s:7 s:7 s:8 s:7 s:8 s:8',
          's:8 s s s S s S s S S S S S S S S',
        ),
        A: bars(
          'C . h . S . h . k k h . S . h .', BOSS_DRUM, BOSS_DRUM, BOSS_ROLL, BOSS_DRUM, BOSS_DRUM, BOSS_DRUM, BOSS_ROLL,
          'C . h . S . h . k k h . S . h .', BOSS_DRUM, BOSS_DRUM, BOSS_ROLL, ...rep(BOSS_DRIVE, 3), BOSS_LAST,
        ),
        B: bars(
          'C . h k S . h . K . h k S . h k', ...rep(BOSS_DRIVE, 2), BOSS_ROLL, 'C . h k S . h . K . h k S . h k', ...rep(BOSS_DRIVE, 2), BOSS_ROLL,
          'C . h k S . h . K . h k S . h k', ...rep(BOSS_DRIVE, 2), BOSS_ROLL, 'C . h k S . h . K . h k S . h k', ...rep(BOSS_DRIVE, 2), 'K . s . s . s s S . S . S S S S',
        ),
        C: bars(
          'C+K . . . . . . . S . . . . . . .', BOSS_HALF_K, BOSS_HALF, 'K . . . . . K . S . . . s . s .',
          BOSS_HALF, BOSS_HALF_K, 'K . . . S . . . K . K . S . . .', 'K . . . S . . . s s s s S S S S',
        ),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// continue — nervous ticking (120 bpm): one figure per countdown number (60 ticks = 2 beats),
// every figure a semitone higher than the one before
// ---------------------------------------------------------------------------------------------

/** The figure for one countdown number: a diminished hop with a chromatic question at the end. */
const COUNT_FIGURE = 'E4 . G4 . A#4 . B4 .';

const CONTINUE: SongDef = {
  bpm: 120,
  vol: 1.25,
  rowsPerBeat: 4,
  // GDD §12.2: a 2-bar loop (four figures, each a semitone up); the order lifts it a major
  // third per pass, so the 10 numbers of the countdown climb 0 … 9 semitones (12 s, then round).
  order: ['A', 'A+4', 'A+8'],
  loop: 0,
  channels: [
    { inst: 'pulse12', vol: 0.8, patterns: { A: [0, 1, 2, 3].map((k) => transpose(COUNT_FIGURE, k)).join(' | ') } },
    { inst: 'bass', vol: 0.9, patterns: { A: [0, 1, 2, 3].map((k) => transpose('E2 . . . . . . .', k)).join(' | ') } },
    // The clock: tick (hat) on the number, tock (rim) half-way.
    { inst: 'drums', vol: 0.7, patterns: { A: rep('H . . . r . . .', 4).join(' | ') } },
  ],
};

// ---------------------------------------------------------------------------------------------
// game-over — D minor, 80 bpm, deflated, 5 s. The line falls toward D and lands a semitone flat
// (C♯ against the D-minor chord): the anthem's wrong note. The anthem wins. Plays once.
// ---------------------------------------------------------------------------------------------

/** 27 rows at 80 bpm = 5.06 s. */
const GAME_OVER: SongDef = {
  bpm: 80,
  rowsPerBeat: 4,
  order: ['A'],
  loop: null,
  channels: [
    { inst: 'pulse50', vol: 0.95, patterns: { A: mel('A4/4 G4/4 F4/4 E4/4 | D4/5 C#4/5 .') } },
    { inst: 'bass', vol: 0.9, patterns: { A: mel('D2/8 A1/8 | Bb1/5 D2/5 .') } },
    { inst: 'pad', vol: 0.6, patterns: { A: mel('D4+F4+A4/16 | D4+F4+Bb4/5 D4+F4+A4/5 .') } },
    { inst: 'drums', vol: 0.6, kit: KIT, patterns: { A: mel('m:5 ./7 m:4 ./7 | m:3 ./4 m:6 ./4 .') } },
  ],
};

// ---------------------------------------------------------------------------------------------
// mission-complete — D major, 140 bpm, 6 s: the Cygnet hook as a fanfare, ending with a honk.
// ---------------------------------------------------------------------------------------------

/** 3½ bars = 56 rows at 140 bpm = 6.0 s. */
const MISSION_COMPLETE: SongDef = {
  bpm: 140,
  rowsPerBeat: 4,
  order: ['A'],
  loop: null,
  channels: [
    {
      inst: SWAN_LEAD,
      vol: 1,
      patterns: {
        A: `${bars(
          'A4 . D5 . F#5 . A5 - - - F#5 - A5 - - -',
          'B5 - - - A5 - - G5 F#5 - - E5 D5 - - -',
          'G5 - - - F#5 - - - E5 - - - A5 - - -',
        )} | D6 - - - - - . .`,
      },
    },
    {
      inst: 'bell',
      vol: 0.55,
      pan: -0.25,
      patterns: {
        A: `${bars(
          'D5 . F#5 . A5 . D6 . . . . . . . . .',
          'G5 . B5 . D6 . . . . . . . . . . .',
          'A5 . C#6 . E6 . . . . . . . . . . .',
        )} | D6 . F#6 . A6 . . .`,
      },
    },
    { inst: 'pad', vol: 0.7, patterns: { A: `${bars(PAD.D, PAD.G, PAD.A)} | D4+F#4+A4 - - - - - . .` } },
    { inst: PADDLE_BASS, vol: 0.9, patterns: { A: `${bars(TITLE_BASS.D, TITLE_BASS.G, TITLE_BASS.Aup)} | D2 - - - - - . .` } },
    {
      inst: 'drums',
      vol: 0.8,
      // x = the Swan's honk (sfx `swan/honk`), the last word after the final chord.
      kit: { x: 'swan/honk' },
      patterns: {
        A: `${bars('K . h . S . h . K . h . S . h .', 'K . h . S . h . K . h . S . s s', 'K . h . S . h . K . s s S s S S')} | C . . . . x . .`,
      },
    },
  ],
};

/** Looping songs of this module by id (tests parse them). */
export const SONGS: Readonly<Record<string, SongDef>> = { title: TITLE, m0: M0, boss: BOSS };

/** Short looping cues (the continue countdown). */
export const CUES: Readonly<Record<string, SongDef>> = { continue: CONTINUE };

/** Jingles that play once (the tally, game over). */
export const JINGLES: Readonly<Record<string, SongDef>> = { 'game-over': GAME_OVER, 'mission-complete': MISSION_COMPLETE };

for (const group of [SONGS, CUES, JINGLES]) for (const [id, song] of Object.entries(group)) defineSong(id, song);
