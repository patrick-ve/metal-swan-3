/**
 * Songs of mission `ring`, DE RING (docs/design/ring.md §11; GDD §12.2). Registers at import time
 * (imported by music/index.ts). Every note was composed for METAL SWAN 3 (docs/ORIGINALITY.md):
 * no melody, bass line or arrangement is taken from any existing tune — in particular no song
 * about a motorway, a car or Amsterdam.
 *
 * - `ring` — the stage theme, a highway drive: A major with a mixolydian G, 140 bpm, a motorik
 *   pulse (straight 8th-note bass, kick on 1 and 3, a steady hat). A bright pulse lead calls the
 *   hook (a syncopated leap up and a fall back), a brassy saw answers it two bars later (call and
 *   response); the streetlight arpeggio and a soft pad come in for the night-drive B.
 *   intro 4 → A 16 (call / response, then the long phrase) → B 16 (the singing line over
 *   D–E–C♯m–F♯m, a climbing build onto F♯) → C 8 (THE LIFT: the hook a whole step up in B
 *   major, the lead doubled an octave up, open hats, 16th bass; the tunnels jump here, see
 *   src/game/ring/cues.ts) → D 8 (a breakdown in F♯m: the blinker rim, shaker, fragments of the
 *   call, a snare build back into A) → loop to A (A + B + C + D = 48 bars = 82.3 s).
 * - `ring-boss` — the test mid-boss (the container lorry): F♯ minor, 152 bpm. A 16th-note saw
 *   ostinato (the air brakes), off-beat stabs, the ring hook bent into minor as the riff.
 *   intro 2 → A 8 → B 8 (long defiant notes over B–D–E) → C 8 (half-time: the major call
 *   returns, a build) → loop to A (A + B + C = 24 bars = 37.9 s).
 *
 * This module imports only the engine (not ./index): music/index.ts imports it, so an import of
 * ./index here would be a cycle whose constants are not yet initialised. Its small pattern helpers
 * (`mel`, `bar16`) therefore follow the shorthand of music/index.ts (`C5/3` = held 3 rows,
 * `C5_3` = 1 row + 2 rests, `./n` = n rests) instead of importing it.
 */
import { defineSong } from '../../../engine/audio';
import { noteToMidi, patternRows, type InstrumentDef, type SongDef } from '../../../engine/music';

// ---------------------------------------------------------------------------------------------
// Pattern helpers (the shorthand of music/index.ts; every bar is checked for 16 rows)
// ---------------------------------------------------------------------------------------------

/** Rows per 4/4 bar at 4 rows per beat. */
export const RING_BAR = 16;

/** Melody shorthand → pattern rows (`X/n` held, `X_n` staccato, `./n` rests). */
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
    if (!(n >= 1)) throw new Error(`music/ring: bad length in "${tok}"`);
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
    if (n !== RING_BAR) throw new Error(`music/ring: bar ${i} has ${n} rows, expected ${RING_BAR}: "${b}"`);
  });
  return list.join(' | ');
}

/** The same bar n times. */
function times(bar: string, n: number): string[] {
  return Array.from({ length: n }, () => bar);
}

const REST_BAR = './16';
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** A note moved by `semis` semitones ('A1', 12 → 'A2'). */
function up(note: string, semis: number): string {
  const m = noteToMidi(note);
  if (m === null) throw new Error(`music/ring: "${note}" is not a note`);
  const r = m + semis;
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

// ---------------------------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------------------------

/** The call: a bright, slightly nasal 25 % pulse with a late vibrato and a short glide. */
const DRIVE_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.006, d: 0.16, s: 0.7, r: 0.09 },
  vol: 0.3,
  vibrato: { rate: 5.8, depth: 12, delay: 0.2 },
  glide: 0.025,
  filter: { type: 'lowpass', freq: 5200, q: 0.7 },
};

/** The lift's octave double: a thin 12.5 % pulse, quieter. */
const HIGH_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.006, d: 0.14, s: 0.6, r: 0.08 },
  vol: 0.2,
  vibrato: { rate: 5.8, depth: 10, delay: 0.24 },
  filter: { type: 'lowpass', freq: 6400, q: 0.7 },
};

/** The response: a brassy pair of detuned saws whose filter snaps open on every note. */
const ANSWER: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.012, d: 0.18, s: 0.55, r: 0.1 },
  vol: 0.22,
  detune: 12,
  filter: { type: 'lowpass', freq: 1900, q: 1.4, env: 2.2 },
};

/** The motorik bass: a plucky saw an octave pulse, the filter opening on every 8th. */
const PULSE_BASS: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.002, d: 0.1, s: 0.5, r: 0.035 },
  vol: 0.27,
  filter: { type: 'lowpass', freq: 900, q: 2.4, env: 2.8 },
};

/** The streetlights: a short 12.5 % pulse blip for 16th-note arpeggios. */
const LIGHTS: InstrumentDef = {
  kind: 'pulse',
  duty: 0.125,
  env: { a: 0.002, d: 0.07, s: 0.12, r: 0.03 },
  vol: 0.17,
  filter: { type: 'lowpass', freq: 4200, q: 0.8 },
};

/** The night pad: three detuned saws, a slow swell, dark. */
const NIGHT_PAD: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.3, d: 0.5, s: 0.75, r: 0.5 },
  vol: 0.11,
  detune: 12,
  filter: { type: 'lowpass', freq: 1400, q: 0.7 },
};

/** Boss off-beat stabs: short detuned saws. */
const BRAKE_STAB: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.003, d: 0.1, s: 0.2, r: 0.05 },
  vol: 0.17,
  detune: 14,
  filter: { type: 'lowpass', freq: 2300, q: 1.1, env: 1.8 },
};

/** Extra drum letters: d ride, z shaker (engine drum sounds). */
const RING_KIT: Readonly<Record<string, string>> = { d: 'drum/ride', z: 'drum/shaker' };

// ---------------------------------------------------------------------------------------------
// Harmony
// ---------------------------------------------------------------------------------------------

interface Chord {
  /** Bass root (octave 1–2). */
  readonly root: string;
  /** Pad voicing. */
  readonly pad: string;
  /** Four arpeggio notes. */
  readonly arp: readonly [string, string, string, string];
}

const CH: Readonly<Record<string, Chord>> = {
  A: { root: 'A1', pad: 'C#4+E4+A4', arp: ['A4', 'C#5', 'E5', 'A5'] },
  G: { root: 'G1', pad: 'B3+D4+G4', arp: ['G4', 'B4', 'D5', 'G5'] },
  D: { root: 'D2', pad: 'A3+D4+F#4', arp: ['F#4', 'A4', 'D5', 'F#5'] },
  E: { root: 'E2', pad: 'B3+E4+G#4', arp: ['E4', 'G#4', 'B4', 'E5'] },
  'F#': { root: 'F#1', pad: 'A#3+C#4+F#4', arp: ['F#4', 'A#4', 'C#5', 'E5'] },
  'F#m': { root: 'F#1', pad: 'A3+C#4+F#4', arp: ['F#4', 'A4', 'C#5', 'F#5'] },
  'C#m': { root: 'C#2', pad: 'G#3+C#4+E4', arp: ['E4', 'G#4', 'C#5', 'E5'] },
  Bm: { root: 'B1', pad: 'B3+D4+F#4', arp: ['F#4', 'B4', 'D5', 'F#5'] },
  B: { root: 'B1', pad: 'B3+D#4+F#4', arp: ['F#4', 'B4', 'D#5', 'F#5'] },
  'C#': { root: 'C#2', pad: 'G#3+C#4+F4', arp: ['F4', 'G#4', 'C#5', 'F5'] },
};

/** The motorik pump: root 8ths with an octave pop, a 16th push and the fifth at the end. */
function pump8(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  const f = up(r, 7);
  return `${r} . ${r} ${r} ${o} . ${r} . ${r} . ${r} ${r} ${o} . ${f} .`;
}

/** The lift's running 16ths. */
function run16(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  const f = up(r, 7);
  return `${r} ${r} ${o} ${r} ${r} ${r} ${o} ${r} ${r} ${r} ${o} ${r} ${f} ${r} ${o} ${r}`;
}

/** Straight 8ths on the root (the intro's pedal). */
function pedal8(c: string): string {
  const r = CH[c].root;
  return `${r} . ${r} . ${r} . ${r} . ${r} . ${r} . ${r} . ${r} .`;
}

/** Half-time: one long root, an octave answer (the breakdown). */
function half(c: string): string {
  const r = CH[c].root;
  return mel(`${r}/8 ./4 ${up(r, 12)}_4`);
}

function padBar(c: string): string {
  return mel(`${CH[c].pad}/16`);
}

/** 16th arpeggio: up, down, up to the top. */
function arpBar(c: string): string {
  const [a, b, d, e] = CH[c].arp;
  return [a, b, d, b, a, b, d, e, d, b, a, b, d, e, d, b].join(' ');
}

const join = (list: readonly string[]): string => bar16(list.join(' | '));
const each = (chords: readonly string[], f: (c: string) => string): string => join(chords.map(f));

// ---------------------------------------------------------------------------------------------
// ring — the stage theme (A major, 140 bpm)
// ---------------------------------------------------------------------------------------------

const INTRO_CH = ['A', 'A', 'G', 'E'];
const A_CH = ['A', 'G', 'D', 'A', 'A', 'G', 'D', 'E', 'F#m', 'D', 'A', 'E', 'F#m', 'D', 'E', 'E'];
const B_CH = ['D', 'E', 'C#m', 'F#m', 'D', 'E', 'A', 'A', 'Bm', 'C#m', 'D', 'E', 'Bm', 'C#m', 'E', 'F#'];
/** C is written in A and played a whole step up ('C+2' in the order: B major). */
const C_CH = ['A', 'G', 'D', 'A', 'A', 'G', 'D', 'E'];
const D_CH = ['F#m', 'F#m', 'D', 'D', 'A', 'A', 'E', 'E'];

/** The hook's call: a syncopated leap up to the top and a fall back (2 bars). */
const CALL_1 = 'E5/3 A5/3 E5/2 C#5/4 E5/4 | D5/3 G5/3 D5/2 B4/6 ./2';
const CALL_2 = 'E5/3 A5/3 E5/2 C#5/4 A5/4 | B5/3 G5/3 D5/2 G5/6 ./2';
/** The response: clipped repeats and a turn down (2 bars), the second ending on the dominant. */
const ANSWER_1 = './4 F#5_2 F#5_2 E5/2 D5/2 A4/4 | C#5/2 D5/2 E5/4 A4/6 ./2';
const ANSWER_2 = './4 F#5_2 A5_2 G5/2 F#5/2 D5/4 | E5/2 F#5/2 G#5/4 B4/6 ./2';

const LEAD_A = bar16(
  `${CALL_1} | ${REST_BAR} | ${REST_BAR} | ${CALL_2} | ${REST_BAR} | ${REST_BAR} |` +
    'C#6/6 B5/2 A5/4 F#5/4 | A5/6 F#5/2 D5/8 | E5/3 A5/3 C#6/2 B5/4 A5/4 | G#5/6 E5/2 B4/8 |' +
    'A5/4 B5/4 C#6/4 E6/4 | F#6/6 E6/2 D6/4 C#6/4 | B5/6 G#5/2 E5/4 G#5/4 | B5/12 ./4',
);
const ANSWER_A = bar16(
  `${REST_BAR} | ${REST_BAR} | ${ANSWER_1} | ${REST_BAR} | ${REST_BAR} | ${ANSWER_2} |` +
    `${REST_BAR} | ${REST_BAR} | ${REST_BAR} | ./8 B4_2 C#5_2 D5_2 E5_2 |` +
    `${REST_BAR} | ${REST_BAR} | ${REST_BAR} | ./8 E5_2 F#5_2 G#5_2 B5_2`,
);

/** B: the singing line, then a climbing arpeggio onto F♯ (the lift's dominant). */
const LEAD_B = bar16(
  'F#5/8 E5/4 D5/4 | E5/12 B4/4 | G#5/8 E5/4 C#5/4 | C#5/12 ./4 |' +
    'A5/8 F#5/4 D5/4 | B5/8 G#5/4 E5/4 | C#6/6 B5/2 A5/8 | A5/12 ./4 |' +
    'D6/8 C#6/4 B5/4 | E6/8 C#6/4 G#5/4 | F#6/6 E6/2 D6/4 A5/4 | B5/12 ./4 |' +
    'B5/4 D6/4 F#6/4 D6/4 | C#6/4 E6/4 G#6/4 E6/4 | B5/4 E6/4 G#6/4 E6/4 | F#5/4 A#5/4 C#6/4 E6/4',
);
/** B: the answer voice holds low counter-notes under the long ones. */
const ANSWER_B = bar16(
  './8 A4/8 | G#4/16 | ./8 E4/8 | F#4/16 | ./8 F#4/8 | G#4/16 | E4/16 | ./8 C#5_2 B4_2 A4/4 |' +
    `./8 F#4/8 | G#4/16 | A4/16 | B4/16 | ${REST_BAR} | ${REST_BAR} | ${REST_BAR} | ${REST_BAR}`,
);

/** C (played +2): the call and the answer together, full band. */
const LEAD_C = bar16(`${CALL_1} | ${REST_BAR} | ${REST_BAR} | ${CALL_2} | ${REST_BAR} | B5/4 C#6/4 D6/4 E6/4`);
/** The lift's octave double (C, +12 on top of the slot's +2): the call kept at or below A5. */
const HIGH_C = bar16(`${CALL_1} | ${REST_BAR} | ${REST_BAR} | E5/3 A5/3 E5/2 C#5/4 A5/4 | G5/8 D5/6 ./2 | ${REST_BAR} | ${REST_BAR}`);
const ANSWER_C = bar16(`${REST_BAR} | ${REST_BAR} | ${ANSWER_1} | ${REST_BAR} | ${REST_BAR} | ${ANSWER_2.replace('B4/6 ./2', 'B4/8')}`);

/** D: fragments of the call in F♯ minor, the last bar runs back up into A. */
const LEAD_D = bar16(
  `${REST_BAR} | ./8 C#5/3 F#5/3 C#5/2 | A4/8 ./8 | ./8 D5/3 F#5/3 D5/2 |` +
    'C#5/8 ./8 | ./8 E5/3 A5/3 E5/2 | G#5/8 B5/8 | B5/2 G#5/2 E5/2 G#5/2 B5/2 D6/2 E6/4',
);

const LEAD_INTRO = bar16(`${REST_BAR} | ${REST_BAR} | ${REST_BAR} | ./8 A4_2 B4_2 C#5_2 D5_2`);

// Drums (16 rows a bar). Kick on 1 and 3 with a push, snare 2 and 4, a steady hat: the motorik.
const MOTO = 'k . h . s . h k k . h . s . h .';
const MOTO_C = 'k+c . h . s . h k k . h . s . h .';
const MOTO_PUSH = 'k . h . s . h k k . h . s . s S';
const MOTO_FILL = 'k . h . s . h . t t t t s s S S';
const RIDE = 'k . d . s . d k k . d . s . d .';
const RIDE_C = 'k+c . d . s . d k k . d . s . d .';
const RIDE_PUSH = 'k . d . s . d k k . d . s . s S';
const LIFT = 'k . h o k+s . h o k . h o k+s . h o';
const LIFT_C = 'k+c . h o k+s . h o k . h o k+s . h o';
const LIFT_FILL = 'k . h o k+s . h o t t t t S S S S';
const BLINK = 'k+r . z . r . z . r . z . r . z .';
const BLINK_K = 'k+r . z . r . z . k+r . z . r . z k';
const ROLL_8 = 's . s . s . s . s . s . s . s s';
const ROLL_16 = 's:5 s:5 s:6 s:6 s:6 s:7 s:7 s:7 s:8 s:8 s:8 s:9 S S S S';

const DRUMS: Readonly<Record<string, string>> = {
  intro: join(['k . . . k . . . k . . . k . . .', 'k . h . k . h . k . h . k . h .', MOTO, 'k . h . s . h . k . s . s s S S']),
  A: join([MOTO_C, MOTO, MOTO, MOTO_PUSH, MOTO, MOTO, MOTO, MOTO_FILL, MOTO_C, MOTO, MOTO, MOTO_PUSH, MOTO, MOTO, MOTO, MOTO_FILL]),
  B: join([RIDE_C, RIDE, RIDE, RIDE_PUSH, RIDE, RIDE, RIDE, MOTO_FILL, RIDE_C, RIDE, RIDE, RIDE_PUSH, MOTO, MOTO, MOTO_PUSH, ROLL_16]),
  C: join([LIFT_C, LIFT, LIFT, LIFT, LIFT_C, LIFT, LIFT, LIFT_FILL]),
  D: join([BLINK, BLINK, BLINK, BLINK_K, BLINK, BLINK_K, ROLL_8, ROLL_16]),
};

const RING: SongDef = {
  bpm: 140,
  rowsPerBeat: 4,
  // Mix level: the ring follows the ams music, which plays as a sample at about −16.4 LUFS
  // integrated (tools/audio/process.ts: −16), so the theme sits at about −16.6 LUFS (≈ −18.7 dB
  // RMS; the lift C is the loudest part, the breakdown D the quietest).
  vol: 1.3,
  order: ['intro', 'A', 'B', 'C+2', 'D'],
  loop: 1,
  channels: [
    // The call (and the B line).
    {
      inst: DRIVE_LEAD,
      vol: 0.95,
      pan: 0.12,
      patterns: { intro: LEAD_INTRO, A: LEAD_A, B: LEAD_B, C: LEAD_C, D: LEAD_D },
    },
    // The lift: the call an octave up.
    { inst: HIGH_LEAD, vol: 0.7, pan: 0.3, transpose: 12, patterns: { C: HIGH_C } },
    // The response.
    { inst: ANSWER, vol: 1, pan: -0.22, patterns: { A: ANSWER_A, B: ANSWER_B, C: ANSWER_C } },
    // The streetlights (B, C and the build of D).
    {
      inst: LIGHTS,
      vol: 0.8,
      pan: -0.4,
      patterns: {
        intro: join(INTRO_CH.map((c, i) => (i < 2 ? REST_BAR : arpBar(c)))),
        B: each(B_CH, arpBar),
        C: each(C_CH, arpBar),
        D: join([...times(REST_BAR, 4), ...D_CH.slice(4).map(arpBar)]),
      },
    },
    // The pad (the second half of A, then B, C and D).
    {
      inst: NIGHT_PAD,
      vol: 0.9,
      pan: 0.25,
      patterns: {
        A: join([...times(REST_BAR, 8), ...A_CH.slice(8).map(padBar)]),
        B: each(B_CH, padBar),
        C: each(C_CH, padBar),
        D: each(D_CH, padBar),
      },
    },
    // The motorik bass.
    {
      inst: PULSE_BASS,
      vol: 1,
      patterns: {
        intro: join(INTRO_CH.map((c, i) => (i < 2 ? pedal8(c) : pump8(c)))),
        A: each(A_CH, pump8),
        B: each(B_CH, pump8),
        C: each(C_CH, run16),
        D: join([...D_CH.slice(0, 4).map(half), ...D_CH.slice(4).map(pump8)]),
      },
    },
    { inst: 'drums', vol: 0.75, kit: RING_KIT, patterns: DRUMS },
  ],
};

// ---------------------------------------------------------------------------------------------
// ring-boss — the test mid-boss (F♯ minor, 152 bpm)
// ---------------------------------------------------------------------------------------------

const BOSS_A_CH = ['F#m', 'D', 'E', 'C#', 'F#m', 'D', 'E', 'C#'];
const BOSS_B_CH = ['Bm', 'Bm', 'D', 'D', 'E', 'E', 'C#', 'C#'];
const BOSS_C_CH = ['F#m', 'F#m', 'D', 'D', 'Bm', 'Bm', 'C#', 'C#'];

/** The air-brake ostinato: root 16ths with octave jumps and the minor third on the turn. */
function brakes(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  const f = up(r, 7);
  const t = up(r, c.endsWith('m') ? 3 : 4);
  return [r, r, o, r, '.', r, f, r, r, o, r, f, o, r, t, f].join(' ');
}

/** Off-beat stabs in a 3+3+2 push. */
function stabs(c: string): string {
  const ch = CH[c].pad;
  return mel(`./2 ${ch}_3 ${ch}_3 ${ch}_2 ./6`);
}

/** The hook bent into minor: the same syncopation, a darker fall. */
const BOSS_LEAD_A = bar16(
  'C#5/3 F#5/3 C#5/2 A4/4 C#5/4 | D5/3 A5/3 F#5/2 D5/6 ./2 | B4/3 E5/3 G#5/2 B5/4 G#5/4 | F5/8 C#5/8 |' +
    'C#5/3 F#5/3 C#5/2 A4/4 F#5/4 | A5/3 F#5/3 D5/2 A5/6 ./2 | G#5/3 B5/3 E6/2 D6/4 B5/4 | C#6/12 ./4',
);
const BOSS_LEAD_B = bar16(
  'D6/12 C#6/2 B5/2 | F#5/16 | A5/12 G#5/2 F#5/2 | D5/16 | B5/12 A5/2 G#5/2 | E5/8 G#5/8 | F5/8 G#5/8 | C#6/12 ./4',
);
/** C: the stage theme's call (in F♯ major colours over the minor), then a build. */
const BOSS_LEAD_C = bar16(
  `${REST_BAR} | ./8 C#5/3 F#5/3 C#5/2 | ${REST_BAR} | ./8 D5/3 A5/3 F#5/2 |` +
    'B4/4 D5/4 F#5/4 B5/4 | D6/4 B5/4 F#5/4 D5/4 | C#5/4 F5/4 G#5/4 C#6/4 | F6/4 C#6/4 G#5/4 F5/4',
);

const B_DR = 'k . h . S . h k k . k h S . h h';
const B_DR_C = 'k+c . h . S . h k k . k h S . h h';
const B_ROLL = 'k . h . S . h . s:5 s:5 s:6 s:6 s:7 s:8 S S';
const B_HALF = 'k . . . h . . . S . . . h . . .';

const BOSS_DRUMS: Readonly<Record<string, string>> = {
  intro: join(['k+c . . . . . . . s:5 s:5 s:6 s:6 s:7 s:7 s:8 s:8', 's:6 s:6 s:7 s:7 s:7 s:8 s:8 s:8 s:9 s:9 S S S S S S']),
  A: join([B_DR_C, B_DR, B_DR, B_ROLL, B_DR_C, B_DR, B_DR, B_ROLL]),
  B: join([B_DR_C, B_DR, B_DR, B_DR, B_DR_C, B_DR, B_DR, B_ROLL]),
  C: join([B_HALF, B_HALF, B_HALF, B_HALF, B_DR, B_DR, ROLL_8, ROLL_16]),
};

const RING_BOSS: SongDef = {
  bpm: 152,
  rowsPerBeat: 4,
  // Mix level: about −16.7 LUFS integrated, like the stage theme and the ams sample music.
  vol: 1.22,
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    { inst: DRIVE_LEAD, vol: 0.95, pan: 0.12, patterns: { A: BOSS_LEAD_A, B: BOSS_LEAD_B, C: BOSS_LEAD_C } },
    { inst: ANSWER, vol: 0.55, pan: -0.2, transpose: -12, patterns: { B: BOSS_LEAD_B } },
    {
      inst: BRAKE_STAB,
      vol: 1,
      pan: -0.25,
      patterns: {
        intro: join([mel(`${CH['F#m'].pad}/16`), mel(`${CH['C#'].pad}/14 ./2`)]),
        A: each(BOSS_A_CH, stabs),
        B: each(BOSS_B_CH, stabs),
        C: each(BOSS_C_CH, padBar),
      },
    },
    {
      inst: PULSE_BASS,
      vol: 1.05,
      patterns: {
        intro: join([REST_BAR, brakes('C#')]),
        A: each(BOSS_A_CH, brakes),
        B: each(BOSS_B_CH, brakes),
        C: join([...BOSS_C_CH.slice(0, 4).map(half), ...BOSS_C_CH.slice(4).map(brakes)]),
      },
    },
    { inst: 'drums', vol: 0.8, kit: RING_KIT, patterns: BOSS_DRUMS },
  ],
};

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** Every song of this module by id (tests parse them). Not part of MISSION_SONGS. */
export const RING_SONGS: Readonly<Record<string, SongDef>> = {
  ring: RING,
  'ring-boss': RING_BOSS,
};

/** The order slot of the stage theme's lift (C): the tunnels jump here (ring/cues.ts). */
export const RING_LIFT_SLOT = RING.order.indexOf('C+2');

for (const [id, song] of Object.entries(RING_SONGS)) defineSong(id, song);
