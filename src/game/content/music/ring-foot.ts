/**
 * Songs of mission `ring` ON FOOT (docs/design/ring.md §R.8, revision R wave B): the synth fallbacks
 * of `ring-foot` (the jam and the blockade: rf-a DE FILE, rf-b DE BLOKKADE) and `ring-boot` (the pink
 * boat DE LAATSTE DRUPPEL). The ElevenLabs takes of the sample group 'mission:ring' replace them when
 * loaded; their tempo, key and form match the take specs in tools/audio/spec.ts. Owner: AUDIO-1.
 * Registers at import time (content/ring/foot/index.ts imports it; it imports only the engine). The
 * drive keeps `ring` / `ring-boss` (music/ring.ts).
 *
 * Every note was composed for METAL SWAN 3 (docs/ORIGINALITY.md): no melody, bass line or
 * arrangement is taken from an existing tune; no march, protest song or brass-band standard is
 * quoted.
 *
 * The sound: a street brass band (a tuba, brass stabs, a trumpet, a muted trumpet, a saxophone), a
 * pea whistle, a street snare with rim clicks and claps, a cowbell; for the boat a marching drum
 * line and a nasal, band-passed "megaphone" lead.
 *
 * - `ring-foot` — a cheeky street-protest groove: B♭ major, 132 bpm, a light swing.
 *   intro 2 (a snare roll, two whistle blasts) → A 8 (the tuba's oom-pah, the whistle's call and
 *   the muted trumpet's answer, off-beat stabs) → B 8 (the brass tune) → B' 8 (the tune again with
 *   the saxophone's counter-line) → R 4 (RISING TENSION: the tuba climbs a semitone a bar D–E♭–E–F,
 *   the snare rolls grow, the cowbell joins) → C 4 (the hook loud with a crash, a drum fill) → loop
 *   to A (32 bars = 58.2 s).
 * - `ring-boot` — the boat: G minor, 150 bpm, a marching drum line.
 *   intro 2 (a snare cadence, a brass stab) → A 8 (snares in 16ths, bass drums on every beat,
 *   off-beat stabs, the megaphone's bossy tune) → B 8 (half time: the trombone's pompous tune in
 *   B♭ major) → C 4 (a drum-band break: snares and toms trade calls) → D 4 (RISING TENSION: brass
 *   stabs climb a semitone a bar E♭–E–F–F♯ over a snare roll) → loop to A (24 bars = 38.4 s).
 *
 * Pattern shorthand as music/oldenzaal.ts (`C5/3` = held 3 rows, `C5_3` = 1 row + 2 rests, `./n` =
 * n rests, `-/n` = hold n rows); every bar is checked for 16 rows.
 */
import { defineSong } from '../../../engine/audio';
import { noteToMidi, patternRows, type InstrumentDef, type SongDef } from '../../../engine/music';
import { defineSfx } from '../../../engine/synth';

// ---------------------------------------------------------------------------------------------
// Pattern helpers
// ---------------------------------------------------------------------------------------------

/** Rows per 4/4 bar at 4 rows per beat. */
export const RF_BAR = 16;

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
    if (!(n >= 1)) throw new Error(`music/ring-foot: bad length in "${tok}"`);
    const fill = m[1] === '.' || m[2] === '_' ? '.' : '-';
    out.push(m[1]);
    for (let i = 1; i < n; i++) out.push(fill);
  }
  return out.join(' ');
}

/** Bars in shorthand separated by '|', each checked for exactly 16 rows. */
function bars(list: readonly string[]): string {
  const out = list.map((b) => mel(b.trim()));
  out.forEach((b, i) => {
    const n = patternRows(b).length;
    if (n !== RF_BAR) throw new Error(`music/ring-foot: bar ${i} has ${n} rows, expected ${RF_BAR}: "${b}"`);
  });
  return out.join(' | ');
}

/** One shorthand string of bars separated by '|'. */
const bar16 = (s: string): string => bars(s.split('|').filter((b) => b.trim().length > 0));

const REST = './16';
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** A note moved by `semis` semitones ('A1', 12 → 'A2'). */
function up(note: string, semis: number): string {
  const m = noteToMidi(note);
  if (m === null) throw new Error(`music/ring-foot: "${note}" is not a note`);
  const r = m + semis;
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

/** The same bar n times. */
const times = (bar: string, n: number): string[] => Array.from({ length: n }, () => bar);

// ---------------------------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------------------------

/** The tuba: a round, buzzy low saw that speaks a little late. */
const TUBA: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.012, d: 0.12, s: 0.7, r: 0.06 },
  vol: 0.3,
  filter: { type: 'lowpass', freq: 430, q: 1.2, env: 1.7 },
};

/** Brass stabs: short detuned saws whose filter snaps open. */
const STAB: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.01, d: 0.13, s: 0.35, r: 0.07 },
  vol: 0.14,
  detune: 12,
  filter: { type: 'lowpass', freq: 2100, q: 1, env: 2.2 },
};

/** The trumpet: a bright saw with a late vibrato. */
const TRUMPET: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.02, d: 0.12, s: 0.75, r: 0.08 },
  vol: 0.19,
  vibrato: { rate: 5.5, depth: 14, delay: 0.2 },
  filter: { type: 'lowpass', freq: 3000, q: 0.9, env: 1.6 },
};

/** The muted trumpet: a thin, nasal pulse through a band-pass (the whistle's answer). */
const MUTED: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.01, d: 0.1, s: 0.6, r: 0.05 },
  vol: 0.3,
  filter: { type: 'bandpass', freq: 1500, q: 1.6 },
};

/** The pea whistle: a high sine with a fast, wide trill. */
const WHISTLE: InstrumentDef = {
  kind: 'sine',
  env: { a: 0.006, d: 0.05, s: 0.9, r: 0.04 },
  vol: 0.13,
  vibrato: { rate: 27, depth: 45, delay: 0 },
};

/** The saxophone's counter-line: a reedy, soft saw an octave under the tune. */
const SAX: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.04, d: 0.15, s: 0.8, r: 0.1 },
  vol: 0.13,
  vibrato: { rate: 5, depth: 10, delay: 0.25 },
  filter: { type: 'lowpass', freq: 1500, q: 2 },
};

/** The megaphone lead: a narrow pulse through a tight band-pass (nasal, buzzy, bossy). */
const MEGAPHONE: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.01, d: 0.1, s: 0.8, r: 0.06 },
  vol: 0.5,
  vibrato: { rate: 6, depth: 10, delay: 0.15 },
  filter: { type: 'bandpass', freq: 1300, q: 2.5 },
};

/** The trombone: a warm saw with a short glide (the boat's pompous tune). */
const TROMBONE: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.03, d: 0.15, s: 0.8, r: 0.1 },
  vol: 0.2,
  glide: 0.05,
  vibrato: { rate: 5, depth: 8, delay: 0.3 },
  filter: { type: 'lowpass', freq: 1500, q: 1, env: 1.4 },
};

// ---------------------------------------------------------------------------------------------
// Drums: the cowbell (music only; the sampled songs replace the whole mix)
// ---------------------------------------------------------------------------------------------

/** A street-band cowbell: two square partials, a short knock. */
defineSfx('drum/ring-cowbell', {
  vol: 0.5,
  layers: [
    { wave: 'square', freq: 562, env: { a: 0.001, d: 0.16 }, vol: 0.5, filter: { type: 'bandpass', freq: 900, q: 2 } },
    { wave: 'square', freq: 845, env: { a: 0.001, d: 0.12 }, vol: 0.4, filter: { type: 'bandpass', freq: 900, q: 2 } },
  ],
});

/** Kit letters: w cowbell (+ the default k s h o c t p r). */
const KIT: Readonly<Record<string, string>> = { w: 'drum/ring-cowbell' };

// ---------------------------------------------------------------------------------------------
// Harmony
// ---------------------------------------------------------------------------------------------

interface Chord {
  /** Tuba root. */
  readonly root: string;
  /** Brass voicing (around the middle). */
  readonly brass: string;
}

const CH: Readonly<Record<string, Chord>> = {
  // ring-foot (B♭ major).
  Bb: { root: 'Bb1', brass: 'D4+F4+Bb4' },
  Eb: { root: 'Eb2', brass: 'Eb4+G4+Bb4' },
  F: { root: 'F1', brass: 'C4+F4+A4' },
  Gm: { root: 'G1', brass: 'D4+G4+Bb4' },
  // ring-boot (G minor; B is in B♭ major).
  'Gm/b': { root: 'G1', brass: 'G3+Bb3+D4' },
  'Eb/b': { root: 'Eb2', brass: 'G3+Bb3+Eb4' },
  'D/b': { root: 'D2', brass: 'F#3+A3+D4' },
  'Bb/b': { root: 'Bb1', brass: 'F3+Bb3+D4' },
  'F/b': { root: 'F1', brass: 'F3+A3+C4' },
};

/** The tuba's oom-pah in 8ths: root, root, fifth, root, root, fifth, the octave, fifth. */
function oompah(c: string): string {
  const r = CH[c].root;
  const f = up(r, 7);
  return mel(`${r}_2 ${r}:6_2 ${f}_2 ${r}:6_2 ${r}_2 ${r}:6_2 ${up(r, 12)}:7_2 ${f}:6_2`);
}

/** Off-beat brass stabs (8ths). */
function offbeats(c: string, v = ''): string {
  const b = CH[c].brass.split('+').map((n) => `${n}${v}`).join('+');
  return mel(`./2 ${b}_2 ./2 ${b}_2 ./2 ${b}_2 ./2 ${b}_2`);
}

/** The marching tuba: root and fifth in quarters. */
function march(c: string): string {
  const r = CH[c].root;
  return mel(`${r}_4 ${up(r, 7)}:7_4 ${r}_4 ${up(r, 7)}:7_4`);
}

// ---------------------------------------------------------------------------------------------
// ring-foot — the jam and the blockade on foot (B♭ major, 132 bpm)
// ---------------------------------------------------------------------------------------------

const F_A = ['Bb', 'Bb', 'Eb', 'F', 'Bb', 'Gm', 'Eb', 'F'];
const F_B = ['Eb', 'F', 'Bb', 'Gm', 'Eb', 'F', 'Bb', 'F'];
const F_C = ['Bb', 'Eb', 'F', 'F'];
/** The rise: the tuba climbs D–E♭–E–F (8ths), the brass stabs climb with it. */
const RISE_ROOTS = ['D2', 'Eb2', 'E2', 'F2'];

/** The whistle's call (bars 1, 3, 5, 7 of A) and the muted trumpet's answer (bars 2, 4, 6, 8). */
const CALL = 'F6_2 F6_2 ./2 D6_2 F6/4 ./4';
const ANSWER = 'Bb4_2 C5_2 D5/4 C5_2 Bb4/2 ./4';
const ANSWER_UP = 'C5_2 D5_2 Eb5/4 D5_2 C5/2 ./4';

/** The brass tune of B (and B'). */
const TUNE_B = bar16('G5/4 F5/4 Eb5/4 D5/4 | C5/6 D5/2 Eb5/4 F5/4 | D5/8 Bb4/8 | ./4 Bb4/2 C5/2 D5/4 Bb4/4 | G5/4 F5/4 Eb5/4 G5/4 | A5/6 G5/2 F5/4 Eb5/4 | D5/6 Eb5/2 F5/8 | C5/12 ./4');
/** The saxophone's counter-line under B'. */
const COUNTER = bar16('Bb4/8 G4/8 | A4/8 C5/8 | F4/8 D4/8 | G4/16 | Bb4/8 G4/8 | C5/8 A4/8 | F4/16 | A4/16');
/** The hook (C): the whistle's call sung by the trumpets, then a climb; the last bar is the fill. */
const HOOK = bar16(`F5_2 F5_2 ./2 D5_2 F5/4 Bb5/4 | G5/4 Eb5/4 G5/4 Bb5/4 | A5/4 F5/4 C6/4 A5/4 | ${REST}`);

// The street groove: kick on 1 and 3, snare + clap on 2 and 4, rim clicks, 8th hats.
const GROOVE = 'k+h . h r s+p . h r k+h . k+h r s+p r h s:4';
const GROOVE_O = 'k+h . o:6 r s+p . o:6 r k+h . k+o:6 r s+p r o:6 s:4';
const FILL = 'k+h . h r s+p . h r s s:5 s:6 s:7 S S S S';
/** The rise: snare 8ths, then 16ths, louder every bar; the cowbell on the beats. */
const RISE_DRUMS = [
  'k+s:4+w . s:4 . k+s:5+w . s:5 . k+s:5+w . s:5 . k+s:6+w . s:6 .',
  'k+s:5+w . s:5 . k+s:6+w . s:6 . k+s:6+w . s:6 . k+s:7+w . s:7 .',
  'k+s:6+w s:5 s:6 s:5 k+s:6+w s:5 s:6 s:6 k+s:7+w s:6 s:7 s:6 k+s:7+w s:6 s:7 s:7',
  'k+S+w s:7 s:7 s:8 k+S+w s:7 s:8 s:8 k+S+w s:8 S s:8 k+S+w S S S',
];
const HOOK_DRUMS = [
  'k+c . h r S+p . h r k+h . k+h r S+p r h s:5',
  'k+h+w . h r S+p . h+w r k+h . k+h+w r S+p r h s:5',
  'k+h+w . h r S+p . h+w r k+h . k+h+w r S+p r h s:5',
  'S . t t:7 S . t:6 t:5 s s:6 s:7 s:8 S S S S',
];

const FOOT_DRUMS: Readonly<Record<string, string>> = {
  intro: bars(['s:3 s:3 s:4 s:4 s:4 s:5 s:5 s:5 s:6 s:6 s:7 s:7 s:8 s:8 S S', 'k+c . . . . . . . k+S . s:6 s:7 S S S S']),
  A: bars([...times(GROOVE, 7), FILL]),
  B: bars([...times(GROOVE_O, 7), FILL]),
  B2: bars([...times(GROOVE_O, 7), FILL]),
  R: bars(RISE_DRUMS),
  C: bars(HOOK_DRUMS),
};

const FOOT: SongDef = {
  bpm: 132,
  rowsPerBeat: 4,
  swing: 0.12,
  // Mix level: about the ring songs' loudness (≈ −19.5 dB RMS through Web Audio, peaks below 0.85;
  // the ring theme −18.7 dB). Measured with tools/lib/audio-report.ts --songs.
  vol: 1.3,
  order: ['intro', 'A', 'B', 'B2', 'R', 'C'],
  loop: 1,
  channels: [
    // The whistle: the intro's two blasts, the call in A, the hook's first bar.
    {
      inst: WHISTLE,
      vol: 1,
      pan: 0.3,
      patterns: {
        intro: bars([REST, 'F6/4 ./4 F6/6 ./2']),
        A: bars([CALL, REST, CALL, REST, CALL, REST, CALL, REST]),
        C: bars([CALL, REST, REST, REST]),
      },
    },
    // The muted trumpet's answer (A).
    { inst: MUTED, vol: 1, pan: -0.25, patterns: { A: bars([REST, ANSWER, REST, ANSWER_UP, REST, ANSWER, REST, ANSWER_UP]) } },
    // The trumpet: the tune (B, B') and the hook (C).
    { inst: TRUMPET, vol: 1, pan: 0.12, patterns: { B: TUNE_B, B2: TUNE_B, C: HOOK } },
    // The saxophone's counter-line (B').
    { inst: SAX, vol: 1, pan: -0.3, patterns: { B2: COUNTER } },
    // The brass stabs: off-beats in A, B and B'; the rise's climbing stabs; the hook's chords.
    {
      inst: STAB,
      vol: 1,
      pan: -0.1,
      patterns: {
        intro: bars([REST, `./8 ${CH.F.brass}!/8`]),
        A: bars(F_A.map((c) => offbeats(c, ':7'))),
        B: bars(F_B.map((c) => offbeats(c, ':6'))),
        B2: bars(F_B.map((c) => offbeats(c, ':7'))),
        R: bars(RISE_ROOTS.map((r) => mel(times(`${up(r, 24)}+${up(r, 28)}+${up(r, 31)}!_4`, 4).join(' ')))),
        C: bars([...F_C.slice(0, 3).map((c) => offbeats(c)), mel(`${CH.F.brass}!_4 ./12`)]),
      },
    },
    // The tuba.
    {
      inst: TUBA,
      vol: 1,
      patterns: {
        intro: bars([REST, mel('./8 F1/8')]),
        A: bars(F_A.map(oompah)),
        B: bars(F_B.map(oompah)),
        B2: bars(F_B.map(oompah)),
        R: bars(RISE_ROOTS.map((r) => mel(times(`${up(r, -12)}_2`, 8).join(' ')))),
        C: bars([...F_C.slice(0, 3).map(oompah), mel('F1_4 ./12')]),
      },
    },
    { inst: 'drums', vol: 0.8, kit: KIT, patterns: FOOT_DRUMS },
  ],
};

// ---------------------------------------------------------------------------------------------
// ring-boot — the pink boat (G minor, 150 bpm)
// ---------------------------------------------------------------------------------------------

const BA = ['Gm/b', 'Gm/b', 'Eb/b', 'D/b', 'Gm/b', 'Gm/b', 'Eb/b', 'D/b'];
const BB = ['Bb/b', 'F/b', 'Gm/b', 'Eb/b', 'Bb/b', 'F/b', 'Eb/b', 'F/b'];
/** The rise (D): brass stabs on E♭, E, F, F♯ (major triads), a semitone a bar, back into G minor. */
const BOAT_RISE = ['Eb2', 'E2', 'F2', 'F#2'];

/** The megaphone's bossy tune (A). */
const MEGA_A = bar16('G5/4 G5_2 A5_2 Bb5/4 A5/4 | G5/6 F5/2 D5/8 | Eb5/4 G5/4 Bb5/4 C6/4 | A5/8 F#5/8 | G5/4 Bb5_2 C6_2 D6/4 C6/4 | Bb5/6 A5/2 G5/8 | Eb6/4 D6/4 C6/4 Bb5/4 | A5/8 D5/8');
/** The trombone's pompous tune (B, half time, B♭ major). */
const BONE_B = bar16('D5/6 Eb5/2 F5/8 | C5/6 D5/2 A4/8 | Bb4/6 C5/2 D5/8 | G5/12 F5_2 Eb5_2 | F5/6 G5/2 F5/4 D5/4 | C5/6 D5/2 F5/8 | G5/4 A5/4 Bb5/4 G5/4 | A5/12 ./4');

// The marching drum line: snares in 16ths, bass drums on every beat.
const MARCH = 'k+S s:4 s:3 s:5 k+s s:4 s:3 s:5 k+S s:4 s:3 s:5 k+s s:4 s:5 s:6';
const MARCH_C = 'k+S+c s:4 s:3 s:5 k+s s:4 s:3 s:5 k+S s:4 s:3 s:5 k+s s:4 s:5 s:6';
const MARCH_FILL = 'k+S s:4 s:3 s:5 k+s s:4 s:3 s:5 k+S s:6 s:6 s:7 S S S S';
const HALF = 'k+S+c s:3 s:3 s:3 s:4 s:3 s:3 s:3 k+S s:3 s:3 s:3 s:4 s:3 s:4 s:5';
const HALF_N = 'k+S s:3 s:3 s:3 s:4 s:3 s:3 s:3 k+S s:3 s:3 s:3 s:4 s:3 s:4 s:5';
/** The break (C): snares call, toms answer. */
const BREAK = ['k+S . s:6 S . . . . t . t:7 T . . . .', 'k+S . s:6 S . s:6 S . t . t:7 T . t:7 T .', 'k+S s:6 S s:6 S . . . t t:7 T t:7 T . . .', 'S s:6 S s:6 S s:6 S s:6 t T t T t T T T'];
const RISE = [
  'k+s:4 s:4 s:4 s:4 k+s:5 s:4 s:5 s:4 k+s:5 s:5 s:5 s:5 k+s:6 s:5 s:6 s:5',
  'k+s:5 s:5 s:5 s:5 k+s:6 s:5 s:6 s:5 k+s:6 s:6 s:6 s:6 k+s:7 s:6 s:7 s:6',
  'k+s:6 s:6 s:6 s:6 k+s:7 s:6 s:7 s:6 k+s:7 s:7 s:7 s:7 k+s:8 s:7 s:8 s:7',
  'k+s:7 s:7 s:8 s:7 k+s:8 s:8 s:8 s:8 k+S S S S k+S S S S',
];

const BOAT_DRUMS: Readonly<Record<string, string>> = {
  intro: bars(['k+S . s:5 s:5 k+S . s:5 s:5 k+S s:5 S s:5 k+S s:5 s:6 s:7', 'k+S s:5 s:6 s:7 S S S S k+S+c . . . . . . .']),
  A: bars([MARCH_C, MARCH, MARCH, MARCH, MARCH_C, MARCH, MARCH, MARCH_FILL]),
  B: bars([HALF, HALF_N, HALF_N, HALF_N, HALF, HALF_N, HALF_N, MARCH_FILL]),
  C: bars(BREAK),
  D: bars(RISE),
};

const BOAT: SongDef = {
  bpm: 150,
  rowsPerBeat: 4,
  // Mix level: about the ring songs' loudness (≈ −19.3 dB RMS through Web Audio, peaks below 0.8).
  // Measured with tools/lib/audio-report.ts --songs.
  vol: 1.1,
  order: ['intro', 'A', 'B', 'C', 'D'],
  loop: 1,
  channels: [
    // The megaphone lead (A).
    { inst: MEGAPHONE, vol: 1, pan: 0.15, patterns: { A: MEGA_A } },
    // The trombone (B).
    { inst: TROMBONE, vol: 1, pan: -0.15, patterns: { B: BONE_B } },
    // The brass stabs.
    {
      inst: STAB,
      vol: 1,
      pan: -0.1,
      patterns: {
        intro: bars([REST, `./8 ${CH['Gm/b'].brass}!_8`]),
        A: bars(BA.map((c) => offbeats(c, ':7'))),
        B: bars(BB.map((c) => mel(`${CH[c].brass}:7/4 ./12`))),
        C: bars(times(mel(`${CH['Gm/b'].brass}!_4 ./12`), 4)),
        D: bars(BOAT_RISE.map((r) => mel(times(`${up(r, 12)}+${up(r, 16)}+${up(r, 19)}!_4`, 4).join(' ')))),
      },
    },
    // The tuba: the march in A, held roots in B, the break's downbeats, the rise's roots.
    {
      inst: TUBA,
      vol: 1,
      patterns: {
        intro: bars([REST, mel('./8 G1/8')]),
        A: bars(BA.map(march)),
        B: bars(BB.map((c) => mel(`${CH[c].root}/8 ${up(CH[c].root, 7)}:7/8`))),
        C: bars(times(mel('G1_4 ./12'), 4)),
        D: bars(BOAT_RISE.map((r) => mel(times(`${up(r, -12)}_2`, 8).join(' ')))),
      },
    },
    { inst: 'drums', vol: 0.85, kit: KIT, patterns: BOAT_DRUMS },
  ],
};

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** The two songs on foot by id (tests parse them; not part of MISSION_SONGS). */
export const RING_FOOT_SONGS: Readonly<Record<string, SongDef>> = {
  'ring-foot': FOOT,
  'ring-boot': BOAT,
};

for (const [id, song] of Object.entries(RING_FOOT_SONGS)) defineSong(id, song);
