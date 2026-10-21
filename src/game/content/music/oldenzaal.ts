/**
 * Songs of mission `oldenzaal` (docs/design/oldenzaal.md §11): the synth fallbacks of the four
 * song ids of ids.ts `OZ_SONG`. The ElevenLabs takes of the sample group 'mission:oldenzaal'
 * (wave B) replace them when loaded; their tempo, key and form match the take specs in
 * tools/audio/spec.ts. Owner: AUDIO. Registers at import time (content manifest id
 * 'music/oldenzaal'; it imports only the engine). Every note was composed for METAL SWAN 3
 * (docs/ORIGINALITY.md): no melody, bass line or arrangement is taken from an existing tune, and
 * no famous organ or horror theme is quoted.
 *
 * The mood: spooky, dark and grim (a haunted town at dusk, a cursed statue, a storm on a church
 * tower). The instruments: a chapel organ (a hollow 50 % pulse with a soft tremulant, a 4' mixture
 * an octave up, a 16' pedal), a wordless synth choir (detuned saws through a vowel band-pass), a
 * thin sine "ghost" lead with a wide vibrato and a slow glide, low FM bells, and a heartbeat drum.
 *
 * - `oldenzaal` — the level theme (oz-a, oz-b; the nave): F minor, 76 bpm.
 *   intro 4 (the pedal, two distant tolls, the heartbeat every two beats) → A 8 (the organ and the
 *   ghost lead: Fm–D♭–B♭m–C, Fm–D♭–G♭–C) → B 8 (THE RISE: the choir comes in, the pedal climbs a
 *   semitone a bar from F to C, the heartbeat doubles; `OZ_THEME_RISE_SLOT`) → C 8 (the climax:
 *   full organ, the A tune an octave up, timpani) → loop to A (24 bars = 75.8 s).
 * - `oldenzaal-boss` — the statue of St. Plechelmus: C minor, 100 bpm, heavy half-time.
 *   intro 2 (stone knocks and a timpani roll under a tritone choir cluster) → A 8 (the 3+3+2 drone
 *   riff, organ stabs, a slow organ tune) → B 8 (the choir holds, a stone 8th ostinato, the tune
 *   high and long) → C 8 (a breakdown of riff and stones, a climbing arpeggio back) → loop to A
 *   (24 bars = 57.6 s).
 * - `oldenzaal-tower` — the climb in the storm: E minor, 168 bpm. The bells are the rhythm: a
 *   3+3+2 peal in 16ths on every bar. intro 2 → A 8 → A+3 8 (the same block a minor third up:
 *   climbing) → B 8 (the chase line over A m–E m–C–B, the Neapolitan F) → C 8 (half-time drums,
 *   the bells alone, then a run back up) → loop to A (32 bars = 45.7 s).
 * - `oldenzaal-tbc` — the TO BE CONTINUED sting: F minor, 96 bpm, two bars played once (5 s): a
 *   toll, the choir on F minor, then a half cadence on C with the ghost lead hanging on B
 *   (unresolved: the story goes on).
 *
 * This module imports only the engine (not ./index), like music/ring.ts: its pattern helpers
 * (`mel`, `bar16`) follow the shorthand of music/index.ts (`C5/3` = held 3 rows, `C5_3` = 1 row +
 * 2 rests, `./n` = n rests, `-/n` = hold n rows).
 */
import { defineSong } from '../../../engine/audio';
import { noteToMidi, patternRows, type ChannelDef, type InstrumentDef, type SongDef } from '../../../engine/music';
import { defineSfx } from '../../../engine/synth';

// ---------------------------------------------------------------------------------------------
// Pattern helpers (every bar is checked for 16 rows)
// ---------------------------------------------------------------------------------------------

/** Rows per 4/4 bar at 4 rows per beat. */
export const OZ_BAR = 16;

/** Melody shorthand → pattern rows (`X/n` held, `X_n` staccato, `./n` rests, `-/n` holds). */
function mel(s: string): string {
  const out: string[] = [];
  for (const tok of s.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const m = /^(.+?)([/_])(\d+)$/.exec(tok);
    if (!m) {
      out.push(tok);
      continue;
    }
    const n = Number(m[3]);
    if (!(n >= 1)) throw new Error(`music/oldenzaal: bad length in "${tok}"`);
    const fill = m[1] === '.' || m[2] === '_' ? '.' : '-';
    out.push(m[1]);
    for (let i = 1; i < n; i++) out.push(fill);
  }
  return out.join(' ');
}

/** Bars in shorthand separated by '|', each checked for exactly 16 rows. */
function bar16(s: string): string {
  const list = s
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map(mel);
  list.forEach((b, i) => {
    const n = patternRows(b).length;
    if (n !== OZ_BAR) throw new Error(`music/oldenzaal: bar ${i} has ${n} rows, expected ${OZ_BAR}: "${b}"`);
  });
  return list.join(' | ');
}

const REST = './16';
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** A note moved by `semis` semitones ('A1', 12 → 'A2'). */
function up(note: string, semis: number): string {
  const m = noteToMidi(note);
  if (m === null) throw new Error(`music/oldenzaal: "${note}" is not a note`);
  const r = m + semis;
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

/** Every note of a pattern moved by `semis` (rests, holds, velocities and accents kept). */
function shift(pattern: string, semis: number): string {
  return patternRows(pattern)
    .map((tok) => {
      if (tok === '.' || tok === '-') return tok;
      return tok
        .split('+')
        .map((p) => {
          const m = /^(~?)([A-G][#b]?\d)(!|:[1-9])?$/.exec(p);
          if (!m) throw new Error(`music/oldenzaal: cannot shift "${p}"`);
          return `${m[1]}${up(m[2], semis)}${m[3] ?? ''}`;
        })
        .join('+');
    })
    .join(' ');
}

/** The same bar n times. */
function times(bar: string, n: number): string[] {
  return Array.from({ length: n }, () => bar);
}

const join = (list: readonly string[]): string => bar16(list.join(' | '));

// ---------------------------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------------------------

/** The chapel organ's 8' flue: a hollow square with a soft tremulant, slow to speak. */
const ORGAN: InstrumentDef = {
  kind: 'pulse',
  duty: 0.5,
  env: { a: 0.03, d: 0.12, s: 0.9, r: 0.28 },
  vol: 0.15,
  tremolo: { rate: 5.2, depth: 0.07 },
  filter: { type: 'lowpass', freq: 1700, q: 0.6 },
};

/** The 4' mixture (played an octave up on its own channel): a thin, reedy edge. */
const MIXTURE: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.03, d: 0.12, s: 0.85, r: 0.25 },
  vol: 0.08,
  tremolo: { rate: 5.2, depth: 0.07 },
  filter: { type: 'lowpass', freq: 3400, q: 0.6 },
};

/** The 16' pedal: a round, slow triangle under everything. */
const PEDAL: InstrumentDef = {
  kind: 'triangle',
  env: { a: 0.04, d: 0.15, s: 0.95, r: 0.35 },
  vol: 0.36,
  filter: { type: 'lowpass', freq: 600, q: 0.7 },
};

/** The wordless choir: three detuned saws through an "ah" band-pass, a slow swell, a slow vibrato. */
const CHOIR: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.55, d: 0.5, s: 0.85, r: 1.0 },
  vol: 0.13,
  detune: 18,
  vibrato: { rate: 4.6, depth: 12, delay: 0.4 },
  filter: { type: 'bandpass', freq: 900, q: 0.8 },
};

/** The ghost lead: a thin sine with a wide, quick vibrato and a slow glide (a haunted whistle). */
const GHOST: InstrumentDef = {
  kind: 'sine',
  env: { a: 0.08, d: 0.2, s: 0.85, r: 0.35 },
  vol: 0.22,
  vibrato: { rate: 6.2, depth: 28, delay: 0.15 },
  glide: 0.12,
};

/** A low church bell: inharmonic FM that rings through its long decay. */
const TOLL: InstrumentDef = {
  kind: 'fm',
  env: { a: 0.002, d: 2.6, s: 0, r: 0.6 },
  vol: 0.2,
  fm: { ratio: 1.41, index: 3.2, decay: 0.9 },
  oneShot: true,
};

/** The tower's small bells: bright, short peals (the rhythm of the climb). */
const CHIME: InstrumentDef = {
  kind: 'fm',
  env: { a: 0.001, d: 0.8, s: 0, r: 0.2 },
  vol: 0.13,
  fm: { ratio: 3.5, index: 2.6, decay: 0.22 },
  oneShot: true,
};

/** Organ stabs: short detuned saws whose filter snaps open. */
const STAB: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.004, d: 0.14, s: 0.3, r: 0.08 },
  vol: 0.15,
  detune: 10,
  filter: { type: 'lowpass', freq: 1500, q: 1, env: 2 },
};

/** The boss drone: a heavy, growling low saw. */
const DRONE: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.006, d: 0.2, s: 0.8, r: 0.1 },
  vol: 0.24,
  detune: 8,
  filter: { type: 'lowpass', freq: 480, q: 1.8, env: 2.4 },
};

/** The tower's chase lead: a 25 % pulse with a short glide and a late vibrato. */
const CHASE: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.006, d: 0.14, s: 0.7, r: 0.08 },
  vol: 0.26,
  vibrato: { rate: 6, depth: 14, delay: 0.18 },
  glide: 0.02,
  filter: { type: 'lowpass', freq: 4200, q: 0.7 },
};

/** The tower's running bass: a plucky saw. */
const RUN_BASS: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.002, d: 0.1, s: 0.5, r: 0.035 },
  vol: 0.25,
  filter: { type: 'lowpass', freq: 850, q: 2.2, env: 2.6 },
};

// ---------------------------------------------------------------------------------------------
// Drums: the heartbeat and the stone (music only; the sampled songs replace the whole mix)
// ---------------------------------------------------------------------------------------------

/** A low, soft heartbeat thump ("lub"; the "dub" is the same at a lower velocity). */
defineSfx('drum/oz-heart', {
  vol: 0.85,
  layers: [
    { wave: 'sine', freq: 72, to: 44, sweep: 0.12, env: { a: 0.004, d: 0.26 }, vol: 1 },
    { wave: 'triangle', freq: 110, to: 70, sweep: 0.06, env: { a: 0.002, d: 0.07 }, vol: 0.35 },
    { wave: 'noise', env: { a: 0.002, d: 0.05 }, vol: 0.25, filter: { type: 'lowpass', freq: 220 } },
  ],
});

/** A dull stone knock: a block struck with a block (the statue's percussion). */
defineSfx('drum/oz-stone', {
  vol: 0.75,
  layers: [
    { wave: 'noise', env: { a: 0.001, d: 0.09 }, vol: 0.8, filter: { type: 'bandpass', freq: 420, q: 1.3 } },
    { wave: 'sine', freq: 130, to: 72, sweep: 0.1, env: { a: 0.001, d: 0.16 }, vol: 0.8 },
    { wave: 'triangle', freq: 340, to: 300, env: { a: 0.0005, d: 0.03 }, vol: 0.45 },
    { wave: 'noise', env: { a: 0.0005, d: 0.012 }, vol: 0.4, filter: { type: 'highpass', freq: 2400 } },
  ],
});

/** Kit letters: b heartbeat, g stone, m timpani, d ride, z shaker (+ the default k s h o c t p r). */
const OZ_KIT: Readonly<Record<string, string>> = { b: 'drum/oz-heart', g: 'drum/oz-stone', m: 'drum/timpani', d: 'drum/ride', z: 'drum/shaker' };

// ---------------------------------------------------------------------------------------------
// Harmony
// ---------------------------------------------------------------------------------------------

interface Chord {
  /** Pedal / bass root. */
  readonly root: string;
  /** Organ voicing (around the middle). */
  readonly organ: string;
  /** Choir voicing (a little higher). */
  readonly choir: string;
}

const CH: Readonly<Record<string, Chord>> = {
  Fm: { root: 'F2', organ: 'F3+Ab3+C4', choir: 'C4+F4+Ab4' },
  Db: { root: 'Db2', organ: 'F3+Ab3+Db4', choir: 'Db4+F4+Ab4' },
  Bbm: { root: 'Bb1', organ: 'F3+Bb3+Db4', choir: 'Db4+F4+Bb4' },
  /** B♭ minor on the rise's climbing pedal (an octave above A's B♭). */
  'Bbm/hi': { root: 'Bb2', organ: 'F3+Bb3+Db4', choir: 'Db4+F4+Bb4' },
  C: { root: 'C2', organ: 'E3+G3+C4', choir: 'C4+E4+G4' },
  Gb: { root: 'Gb2', organ: 'Gb3+Bb3+Db4', choir: 'Db4+Gb4+Bb4' },
  Ab: { root: 'Ab2', organ: 'Eb3+Ab3+C4', choir: 'C4+Eb4+Ab4' },
  /** The rise's diminished colours over the climbing pedal. */
  'Edim/G': { root: 'G2', organ: 'E3+G3+Bb3+Db4', choir: 'Db4+E4+G4' },
  Adim: { root: 'A2', organ: 'A3+C4+Eb4', choir: 'C4+Eb4+A4' },
  Bdim: { root: 'B2', organ: 'B3+D4+F4', choir: 'D4+F4+Ab4' },
  'C/C': { root: 'C3', organ: 'E3+G3+C4', choir: 'C4+E4+G4' },
  // The boss (C minor).
  Cm: { root: 'C2', organ: 'G3+C4+Eb4', choir: 'C4+Eb4+G4' },
  G: { root: 'G1', organ: 'G3+B3+D4', choir: 'B3+D4+G4' },
  'Fm/C': { root: 'F1', organ: 'F3+Ab3+C4', choir: 'C4+F4+Ab4' },
  'Db/b': { root: 'Db2', organ: 'Ab3+Db4+F4', choir: 'Db4+F4+Ab4' },
  // The tower (E minor).
  Em: { root: 'E2', organ: 'G3+B3+E4', choir: 'B3+E4+G4' },
  Cmaj: { root: 'C2', organ: 'G3+C4+E4', choir: 'C4+E4+G4' },
  D: { root: 'D2', organ: 'F#3+A3+D4', choir: 'A3+D4+F#4' },
  B: { root: 'B1', organ: 'F#3+B3+D#4', choir: 'B3+D#4+F#4' },
  Am: { root: 'A1', organ: 'A3+C4+E4', choir: 'C4+E4+A4' },
  F: { root: 'F2', organ: 'F3+A3+C4', choir: 'C4+F4+A4' },
};

/** Held chords: a chord that repeats the previous bar's holds on (the organ never re-speaks). */
function held(chords: readonly string[], voice: (c: Chord) => string): string {
  return join(chords.map((c, i) => (i > 0 && chords[i - 1] === c ? '-/16' : `${voice(CH[c])}/16`)));
}

const organOf = (c: Chord): string => c.organ;
const choirOf = (c: Chord): string => c.choir;

/** The pedal in half notes (root, then the root again an octave up at a low velocity). */
function pedalHalf(c: string): string {
  const r = CH[c].root;
  return mel(`${r}/8 ${up(r, 12)}:5/8`);
}

/** The pedal held for the whole bar. */
function pedalWhole(c: string): string {
  return mel(`${CH[c].root}/16`);
}

// ---------------------------------------------------------------------------------------------
// oldenzaal — the level theme (F minor, 76 bpm)
// ---------------------------------------------------------------------------------------------

const A_CH = ['Fm', 'Db', 'Bbm', 'C', 'Fm', 'Db', 'Gb', 'C'];
/** The rise: the pedal climbs F–G♭–G–A♭–A–B♭–B–C. */
const B_CH = ['Fm', 'Gb', 'Edim/G', 'Ab', 'Adim', 'Bbm/hi', 'Bdim', 'C/C'];
const C_CH = ['Fm', 'Db', 'Bbm', 'C', 'Fm', 'Db', 'Gb', 'C'];

/** The ghost tune of A: a sigh up a semitone and back, a fall, a climb onto the dominant. */
const TUNE_A = bar16(
  'C5/8 Db5/4 C5/4 | Ab4/12 F4/4 | Bb4/6 Db5/2 F5/8 | E5/12 ./4 |' + 'Ab5/8 G5/4 F5/4 | F5/6 Eb5/2 Db5/8 | Db5/8 Bb4/4 Gb4/4 | B4/8 C5/8',
);
/** The rise: long notes that climb with the pedal. */
const TUNE_B = bar16('F5/16 | Gb5/8 F5/8 | G5/12 E5/4 | Ab5/16 | A5/8 C6/8 | Bb5/12 Db6/4 | B5/8 D6/4 F6/4 | E6/12 ./4');
/** The climax: the A tune an octave up; the last bar falls back down for the loop. */
const TUNE_C = bar16([...TUNE_A.split(' | ').slice(0, 7).map((b) => shift(b, 12)), 'C6/4 G5/4 E5/4 C5/4'].join(' | '));

// Drums: the heartbeat ("lub-dub") every two beats in A, every beat in the rise.
const HEART_2 = 'b b:5 . . . . . . b b:5 . . . . . .';
const HEART_4 = 'b b:5 . . b b:5 . . b b:5 . . b b:5 . .';
const HEART_4M = 'b+m:6 b:5 . . b b:5 . . b+m:5 b:5 . . b b:5 . .';
const HEART_ROLL = 'b b:5 . . b b:5 . . m:4 m:4 m:5 m:5 m:6 m:7 m:8 M';

const THEME_DRUMS: Readonly<Record<string, string>> = {
  intro: join(['b:4 b:3 . . . . . . . . . . . . . .', 'b:5 b:3 . . . . . . b:5 b:3 . . . . . .', HEART_2, HEART_2]),
  A: join([...times(HEART_2, 7), 'b b:5 . . . . . . b b:5 . . g:4 . g:5 .']),
  B: join([...times(HEART_4, 7), HEART_ROLL]),
  C: join(['b+M+c:5 b:5 . . b b:5 . . b+m:5 b:5 . . b b:5 . .', ...times(HEART_4M, 6), HEART_ROLL]),
};

const THEME: SongDef = {
  bpm: 76,
  rowsPerBeat: 4,
  // Mix level: about the ring songs' loudness (≈ −18.5 dB RMS through Web Audio, the rise and the
  // climax the loudest parts; peaks below 0.6). Measured with tools/lib/audio-report.ts --songs.
  vol: 0.7,
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    // The ghost lead (A, the rise; C an octave up).
    { inst: GHOST, vol: 1, pan: 0.15, patterns: { A: TUNE_A, B: TUNE_B, C: TUNE_C } },
    // The organ (the intro's low swell, then every section).
    {
      inst: ORGAN,
      vol: 1,
      pan: -0.12,
      patterns: {
        intro: join([REST, REST, mel('F3+C4/16'), mel('-/16')]),
        A: held(A_CH, organOf),
        B: held(B_CH, organOf),
        C: held(C_CH, organOf),
      },
    },
    // The mixture (the rise and the climax).
    { inst: MIXTURE, vol: 0.9, pan: 0.2, transpose: 12, patterns: { B: held(B_CH, organOf), C: held(C_CH, organOf) } },
    // The choir (the rise and the climax).
    { inst: CHOIR, vol: 1, pan: -0.25, patterns: { B: held(B_CH, choirOf), C: held(C_CH, choirOf) } },
    // The pedal.
    {
      inst: PEDAL,
      vol: 1,
      patterns: {
        intro: join([mel('F2/16'), mel('-/16'), mel('-/16'), mel('-/16')]),
        A: join(A_CH.map(pedalWhole)),
        B: join(B_CH.map(pedalWhole)),
        C: join(C_CH.map(pedalHalf)),
      },
    },
    // The distant tolls.
    {
      inst: TOLL,
      vol: 1,
      pan: 0.3,
      patterns: {
        intro: join([mel('F3/16'), REST, mel('C3:6/16'), REST]),
        A: join([mel('F3:6/16'), REST, REST, REST, mel('F3:5/16'), REST, REST, mel('C3:6/16')]),
        C: join([mel('F3/16'), REST, REST, REST, mel('F3/16'), REST, REST, mel('C3/16')]),
      },
    },
    { inst: 'drums', vol: 0.8, kit: OZ_KIT, patterns: THEME_DRUMS },
  ],
};

/** The order index of the theme's rise (B): a script may start the theme there (`from`). */
export const OZ_THEME_RISE_SLOT = THEME.order.indexOf('B');

// ---------------------------------------------------------------------------------------------
// oldenzaal-boss — the statue (C minor, 100 bpm)
// ---------------------------------------------------------------------------------------------

const BA_CH = ['Cm', 'Cm', 'Ab', 'G', 'Cm', 'Cm', 'Ab', 'G'];
const BB_CH = ['Fm/C', 'Fm/C', 'Db/b', 'Db/b', 'Ab', 'Ab', 'G', 'G'];
const BC_CH = ['Cm', 'Cm', 'Ab', 'Ab', 'Fm/C', 'Fm/C', 'G', 'G'];

/** The 3+3+2 drone riff on the root, with a minor third and a tritone turn. */
function riff(c: string): string {
  const r = CH[c].root;
  return mel(`${r}/3 ${r}_3 ${up(r, 3)}/2 ${r}/3 ${up(r, 7)}_3 ${up(r, 6)}/2`);
}

/** Off-beat organ stabs in the gaps of the riff. */
function stabs(c: string): string {
  const o = CH[c].organ;
  return mel(`./2 ${o}_2 ./4 ./2 ${o}_2 ./2 ${o}_2`);
}

const BOSS_TUNE_A = bar16('G5/8 Ab5/4 G5/4 | F#5/8 Eb5/8 | C5/6 D5/2 Eb5/8 | D5/12 ./4 | G5/8 Ab5/4 Bb5/4 | C6/8 B5/8 | Ab5/6 G5/2 F5/4 Eb5/4 | D5/8 B4/8');
const BOSS_TUNE_B = bar16('C6/16 | Bb5/8 Ab5/8 | Db6/16 | C6/8 Bb5/8 | Eb6/16 | D6/8 C6/8 | B5/16 | D6/8 G5/8');
const BOSS_TUNE_C = bar16(`${REST} | ${REST} | ${REST} | ${REST} | G4/4 C5/4 Eb5/4 G5/4 | Ab5/4 F5/4 C5/4 Ab4/4 | B4/4 D5/4 F5/4 G5/4 | B5/16`);

// Drums: a heavy half-time (the kick on 1, the stone on 3), toms and stones in the fills.
const BD = 'k . . . . . g . G . . . . . g .';
const BD_C = 'k+c . . . . . g . G . . . . . g .';
const BD_FILL = 'k . . . . . g . G . t . t t T T';
const BD_STONES = 'k . g . g . g . G . g . g . g g';
const BD_STONES_C = 'k+c . g . g . g . G . g . g . g g';
const BD_ROLL = 'G . g g G . g g m:5 m:5 m:6 m:6 m:7 m:8 m:9 M';

const BOSS_DRUMS: Readonly<Record<string, string>> = {
  intro: join(['g:5 . . . g:5 . . . g:6 . . . g:6 . g:7 .', 'g:7 . g:7 . m:4 m:4 m:5 m:5 m:6 m:6 m:7 m:7 m:8 m:8 m:9 m:9']),
  A: join([BD_C, BD, BD, BD_FILL, BD_C, BD, BD, BD_FILL]),
  B: join([BD_STONES_C, BD_STONES, BD_STONES, BD_STONES, BD_STONES_C, BD_STONES, BD_STONES, BD_ROLL]),
  C: join(['k+c . . . . . . . . . . . . . . .', 'g . . . . . . . g . . . . . . .', 'k . . . . . g . G . . . . . . .', 'g . . . g . . . g . . . g . g .', BD, BD, BD_STONES, BD_ROLL]),
};

const BOSS: SongDef = {
  bpm: 100,
  rowsPerBeat: 4,
  // Mix level: ≈ −19.8 dB RMS, peaks below 0.85 (the stones and the timpani are the peaks).
  vol: 1,
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    // The tune on the organ, its mixture an octave up in B.
    { inst: ORGAN, vol: 1.1, pan: 0.12, patterns: { A: BOSS_TUNE_A, B: BOSS_TUNE_B, C: BOSS_TUNE_C } },
    { inst: MIXTURE, vol: 0.9, pan: 0.25, patterns: { B: BOSS_TUNE_B } },
    // The choir: the intro's tritone cluster, then held chords.
    {
      inst: CHOIR,
      vol: 1.1,
      pan: -0.22,
      patterns: {
        intro: join([mel('C4+Eb4+F#4/16'), mel('-/16')]),
        A: held(BA_CH, choirOf),
        B: held(BB_CH, choirOf),
        C: held(BC_CH, choirOf),
      },
    },
    // The organ stabs.
    { inst: STAB, vol: 1, pan: -0.3, patterns: { A: join(BA_CH.map(stabs)), C: join([...times(REST, 4), ...BC_CH.slice(4).map(stabs)]) } },
    // The drone riff.
    {
      inst: DRONE,
      vol: 1,
      patterns: {
        intro: join([REST, mel('C2/16')]),
        A: join(BA_CH.map(riff)),
        B: join(BB_CH.map(pedalHalf)),
        C: join(BC_CH.map(riff)),
      },
    },
    // A toll at the top of each phrase.
    {
      inst: TOLL,
      vol: 0.9,
      pan: 0.3,
      patterns: { A: join([mel('C3/16'), REST, REST, REST, mel('C3/16'), REST, REST, REST]), B: join([mel('F3/16'), REST, REST, REST, mel('Ab3/16'), REST, REST, REST]) },
    },
    { inst: 'drums', vol: 0.65, kit: OZ_KIT, patterns: BOSS_DRUMS },
  ],
};

// ---------------------------------------------------------------------------------------------
// oldenzaal-tower — the climb (E minor, 168 bpm; the bells are the rhythm)
// ---------------------------------------------------------------------------------------------

const TA_CH = ['Em', 'Cmaj', 'D', 'B', 'Em', 'Cmaj', 'D', 'B'];
const TB_CH = ['Am', 'Em', 'Cmaj', 'B', 'Am', 'Em', 'F', 'B'];
const TC_CH = ['Em', 'Em', 'Cmaj', 'Cmaj', 'Am', 'Am', 'B', 'B'];

/** The peal: the chord's top, root and fifth in a 3+3+2 / 3+3+2 pattern of 16ths. */
function peal(c: string): string {
  const [a, b, d] = CH[c].choir.split('+');
  const hi = up(a, 12);
  const mid = up(b, 12);
  const top = up(d, 12);
  return [hi, '.', '.', mid, '.', '.', top, '.', hi, '.', '.', mid, '.', '.', up(b, 24), '.'].join(' ');
}

/** The running bass: root 8ths with an octave pop and the fifth at the end. */
function run(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  const f = up(r, 7);
  return `${r} . ${r} ${r} ${o} . ${r} . ${r} . ${r} ${r} ${o} . ${f} .`;
}

/** Half-time: one long root and an octave answer. */
function halfBass(c: string): string {
  const r = CH[c].root;
  return mel(`${r}/8 ./4 ${up(r, 12)}_4`);
}

function stab2(c: string): string {
  const o = CH[c].organ;
  return mel(`${o}_2 ./6 ./2 ${o}_2 ./4`);
}

const TOWER_TUNE_A = bar16(
  'E5/2 G5/2 B5/4 A5/2 G5/2 F#5/4 | E5/4 C5/4 E5/4 G5/4 | F#5/2 A5/2 D6/4 C6/2 B5/2 A5/4 | B5/8 D#5/8 |' +
    'E5/2 G5/2 B5/4 C6/2 B5/2 A5/4 | G5/4 E5/4 C5/4 E5/4 | D5/2 F#5/2 A5/4 G5/2 F#5/2 E5/4 | D#5/12 ./4',
);
const TOWER_TUNE_B = bar16(
  'A5/6 C6/2 B5/4 A5/4 | G5/6 B5/2 E5/8 | E5/6 G5/2 C6/4 B5/4 | D#6/8 B5/8 |' + 'A5/6 C6/2 E6/4 D6/4 | B5/6 G5/2 E5/8 | F5/6 A5/2 C6/4 A5/4 | B5/16',
);
const TOWER_TUNE_C = bar16(`${REST} | ${REST} | ${REST} | ${REST} | E5/4 F#5/4 G5/4 A5/4 | B5/4 C6/4 D6/4 E6/4 | D#6/8 F#6/8 | B5/16`);

const T_DR = 'k . h k s . h . k . h k s . h h';
const T_DR_C = 'k+c . h k s . h . k . h k s . h h';
const T_FILL = 'k . h k s . h . t t t t S S S S';
const T_HALF = 'k . . . h . . . s . . . h . . .';
const T_BUILD = 's . s . s . s . s s s s S S S S';

const TOWER_DRUMS: Readonly<Record<string, string>> = {
  intro: join(['k . . . k . . . k . . . k . . .', 'k . h . k . h . s s s s S S S S']),
  A: join([T_DR_C, T_DR, T_DR, T_FILL, T_DR_C, T_DR, T_DR, T_FILL]),
  B: join([T_DR_C, T_DR, T_DR, T_FILL, T_DR_C, T_DR, T_DR, T_BUILD]),
  C: join([T_HALF, T_HALF, T_HALF, T_HALF, T_DR, T_DR, T_FILL, T_BUILD]),
};

const TOWER: SongDef = {
  bpm: 168,
  rowsPerBeat: 4,
  // Mix level: ≈ −18.2 dB RMS, peaks below 0.8.
  vol: 1.15,
  order: ['intro', 'A', 'A+3', 'B', 'C'],
  loop: 1,
  channels: [
    { inst: CHASE, vol: 1, pan: 0.12, patterns: { A: TOWER_TUNE_A, B: TOWER_TUNE_B, C: TOWER_TUNE_C } },
    // The bells (the rhythm; every section).
    {
      inst: CHIME,
      vol: 1,
      pan: -0.3,
      patterns: {
        intro: join([REST, peal('Em')]),
        A: join(TA_CH.map(peal)),
        B: join(TB_CH.map(peal)),
        C: join(TC_CH.map(peal)),
      },
    },
    { inst: STAB, vol: 0.9, pan: 0.28, patterns: { A: join(TA_CH.map(stab2)), B: join(TB_CH.map(stab2)) } },
    { inst: CHOIR, vol: 1, pan: -0.15, patterns: { B: held(TB_CH, choirOf), C: held(TC_CH, choirOf) } },
    {
      inst: RUN_BASS,
      vol: 1,
      patterns: {
        intro: join([mel('E2/16'), run('Em')]),
        A: join(TA_CH.map(run)),
        B: join(TB_CH.map(run)),
        C: join([...TC_CH.slice(0, 4).map(halfBass), ...TC_CH.slice(4).map(run)]),
      },
    },
    { inst: TOLL, vol: 0.8, pan: 0.3, patterns: { intro: join([mel('E3/16'), REST]), C: join([mel('E3/16'), REST, mel('C3/16'), REST, REST, REST, REST, REST]) } },
    { inst: 'drums', vol: 0.8, kit: OZ_KIT, patterns: TOWER_DRUMS },
  ],
};

// ---------------------------------------------------------------------------------------------
// oldenzaal-tbc — the TO BE CONTINUED sting (F minor → C, 96 bpm, played once)
// ---------------------------------------------------------------------------------------------

const TBC_CHANNELS: ChannelDef[] = [
  { inst: GHOST, vol: 1, pan: 0.15, patterns: { A: join([mel('./4 C6/6 Db6/2 C6/4'), mel('B5/16')]) } },
  { inst: CHOIR, vol: 1.2, pan: -0.2, patterns: { A: join([mel('C4+F4+Ab4/16'), mel('C4+E4+G4/16')]) } },
  { inst: ORGAN, vol: 0.9, pan: -0.1, patterns: { A: join([mel('F3+Ab3+C4/16'), mel('E3+G3+C4/16')]) } },
  { inst: PEDAL, vol: 1, patterns: { A: join([mel('F2/16'), mel('C2/16')]) } },
  { inst: TOLL, vol: 1.1, pan: 0.3, patterns: { A: join([mel('F3/16'), mel('C3/16')]) } },
  { inst: 'drums', vol: 0.85, kit: OZ_KIT, patterns: { A: join(['M+b b:5 . . . . . . b:5 b:3 . . . . . .', 'm:5 m:5 m:6 m:6 m:7 m:7 M . b:4 b:3 . . . . . .']) } },
];

const TBC: SongDef = {
  bpm: 96,
  rowsPerBeat: 4,
  // Mix level: a sting, a little louder than the songs (≈ −17 dB RMS, peaks below 0.8).
  vol: 0.75,
  order: ['A'],
  loop: null,
  channels: TBC_CHANNELS,
};

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** Every song of this module by id (ids.ts `OZ_SONG`; tests parse them). Not part of MISSION_SONGS. */
export const OZ_SONGS: Readonly<Record<string, SongDef>> = {
  oldenzaal: THEME,
  'oldenzaal-boss': BOSS,
  'oldenzaal-tower': TOWER,
  'oldenzaal-tbc': TBC,
};

for (const [id, song] of Object.entries(OZ_SONGS)) defineSong(id, song);
