/**
 * Songs of mission `oat` (level 2, OAT OF CONTROL; docs/design/oat.md §9.1): the day-to-night score,
 * the synth fallbacks of the five ids of ids.ts `OAT_SONG`. The ElevenLabs takes of the sample group
 * 'mission:oat' (wave C; tools/audio/spec.ts, from `OAT_TAKES`) replace them when loaded. Owner:
 * AUDIO. Registers at import time (content manifest id 'music/oat', LAZY with the oat chunk:
 * content/index.ts `isOatContent`; it imports only the engine). Every note was composed for METAL
 * SWAN 3 (docs/ORIGINALITY.md): no melody, bass line or arrangement is taken from an existing tune.
 *
 * Parts: a script enters a part with `ctx.music(id, fade, { from: slot, restart: true })` (the slot
 * constants below); the song then plays on in its order and loops to its `loop` slot. A take enters
 * the same part through its `marks` (`OAT_TAKES` → the spec's `slotBeats` → audio:ship).
 *
 * - `oat-a` — DE 9 STRAATJES, the bright morning: G major, 116 bpm. Marimba, pizzicato strings,
 *   a plucky bass, hand claps and a shaker; a glockenspiel doubles the hook.
 *   intro 2 → A 8 (the marimba tune) → B 8 (the hook with the glockenspiel) → C 8 (a break: the
 *   strings and the claps alone, then the marimba calls back) → loop to A (24 bars = 49.7 s).
 * - `oat-b` — FORT NEGEN & ZESTIG, the tense noon: D minor, 108 bpm. A ticking clock (two wood
 *   ticks), pizzicato, a sneaky reed lead, the shop bell. intro 2 → A 8 (the ticking ostinato) →
 *   A2 8 (the sneaky tune) → B 8 (DE RIJ: F major, a mock-patient tune, the shop bell; `OAT_B_QUEUE_SLOT`)
 *   → B2 8 (the tune on the glockenspiel) → loop to A (32 bars = 71.1 s).
 * - `oat-c` — DE KADEMUUR and the chase (also the taxi ride): 144 bpm. Part A, the golden
 *   afternoon in G major: a clean guitar-like pluck, a soft pad, a lazy whistle tune, half-time
 *   drums (intro 2 → A 8 → A2 8 → A → A2: 56.7 s, played once). Part B, the chase in E minor
 *   (`OAT_C_CHASE_SLOT`): driving drums, a running bass, brass stabs and a brass lead (B 8 → B2 8 →
 *   B3 8, the build) → loop to B (24 bars = 40 s).
 * - `oat-d` — DE WALLEN BY NIGHT, the neon synth: C minor, 104 bpm. A pulsing octave bass, slow
 *   arpeggios, a wide pad and a saw lead. intro 2 → A 8 → B 8 (the lead climbs) → A2 8 (the tune an
 *   octave up) → C 8 → C2 8 (the sparse part after 02:00: pad, arpeggio and hats; `OAT_D_LATE_SLOT`)
 *   → loop to A (40 bars = 92.3 s).
 * - `oat-boss` — the two bosses: 132 bpm. Part A, De Makelaar (slot 0): a cocky funk strut in A
 *   minor (octave-popping bass, clav stabs, a wah-ish lead, claps and coins); A2 is the break; the
 *   second round climbs a whole tone (`A+2`: he overbids). Part B, De Huisjesmelker
 *   (`OAT_BOSS_HUISJESMELKER_SLOT`): a heavy minor waltz in G minor, 3/4, oom-pah-pah with a tuba
 *   bass and cash-register percussion; Bi 2 → B 16 → B2 16 (the tune an octave up) → loop to B
 *   (32 waltz bars = 43.6 s).
 *
 * Pattern shorthand as music/oldenzaal.ts (`C5/3` = held 3 rows, `C5_3` = 1 row + 2 rests, `./n`
 * = n rests, `-/n` = hold n rows); every bar is checked for its rows (16 in 4/4, 12 in 3/4).
 */
import { defineSong } from '../../../engine/audio';
import { noteToMidi, patternRows, type InstrumentDef, type SongDef } from '../../../engine/music';
import { defineSfx } from '../../../engine/synth';

// ---------------------------------------------------------------------------------------------
// Pattern helpers
// ---------------------------------------------------------------------------------------------

/** Rows per 4/4 bar (4 rows per beat). */
export const OAT_BAR = 16;
/** Rows per 3/4 bar (the waltz). */
export const OAT_WALTZ_BAR = 12;

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
    if (!(n >= 1)) throw new Error(`music/oat: bad length in "${tok}"`);
    const fill = m[1] === '.' || m[2] === '_' ? '.' : '-';
    out.push(m[1]);
    for (let i = 1; i < n; i++) out.push(fill);
  }
  return out.join(' ');
}

/** Bars in shorthand separated by '|', each checked for exactly `rows` rows. */
function bars(s: string, rows = OAT_BAR): string {
  const list = s
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map(mel);
  list.forEach((b, i) => {
    const n = patternRows(b).length;
    if (n !== rows) throw new Error(`music/oat: bar ${i} has ${n} rows, expected ${rows}: "${b}"`);
  });
  return list.join(' | ');
}

const join = (list: readonly string[], rows = OAT_BAR): string => bars(list.join(' | '), rows);
const REST = './16';
const WREST = './12';
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** A note moved by `semis` semitones ('A1', 12 → 'A2'). */
function up(note: string, semis: number): string {
  const m = noteToMidi(note);
  if (m === null) throw new Error(`music/oat: "${note}" is not a note`);
  const r = m + semis;
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

/** Every note of a pattern moved by `semis` semitones (rests, holds and velocities kept). */
function shift(pattern: string, semis: number): string {
  return patternRows(pattern)
    .map((tok) => {
      if (tok === '.' || tok === '-') return tok;
      return tok
        .split('+')
        .map((p) => {
          const m = /^(~?)([A-G][#b]?\d)(!|:[1-9])?$/.exec(p);
          if (!m) throw new Error(`music/oat: cannot shift "${p}"`);
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

// ---------------------------------------------------------------------------------------------
// Harmony: root (bass) and three chord tones in the middle (pizz, pad, stabs)
// ---------------------------------------------------------------------------------------------

interface Chord {
  readonly root: string;
  readonly tones: readonly [string, string, string];
}

const ch = (root: string, a: string, b: string, c: string): Chord => ({ root, tones: [a, b, c] });

const CH: Readonly<Record<string, Chord>> = {
  // oat-a (G major)
  G: ch('G2', 'G4', 'B4', 'D5'),
  D: ch('D2', 'F#4', 'A4', 'D5'),
  Em: ch('E2', 'E4', 'G4', 'B4'),
  C: ch('C2', 'E4', 'G4', 'C5'),
  Am: ch('A1', 'E4', 'A4', 'C5'),
  Bm: ch('B1', 'F#4', 'B4', 'D5'),
  A: ch('A1', 'E4', 'A4', 'C#5'),
  B: ch('B1', 'F#4', 'B4', 'D#5'),
  // oat-b (D minor, F major)
  Dm: ch('D2', 'F4', 'A4', 'D5'),
  Gm: ch('G2', 'G4', 'Bb4', 'D5'),
  Bb: ch('Bb1', 'F4', 'Bb4', 'D5'),
  F: ch('F2', 'F4', 'A4', 'C5'),
  // oat-d (C minor)
  Cm: ch('C2', 'G4', 'C5', 'Eb5'),
  Ab: ch('Ab1', 'Ab4', 'C5', 'Eb5'),
  Eb: ch('Eb2', 'G4', 'Bb4', 'Eb5'),
  Fm: ch('F2', 'F4', 'Ab4', 'C5'),
  'G/d': ch('G1', 'G4', 'B4', 'D5'),
  // oat-boss A (A minor funk: sevenths)
  Am7: ch('A1', 'G4', 'C5', 'E5'),
  D7: ch('D2', 'F#4', 'C5', 'E5'),
  Fmaj7: ch('F2', 'E4', 'A4', 'C5'),
  E7: ch('E2', 'G#4', 'D5', 'E5'),
  // oat-boss B (G minor waltz)
  'Gm/w': ch('G1', 'G4', 'Bb4', 'D5'),
  'D7/w': ch('D2', 'F#4', 'A4', 'C5'),
  'Cm/w': ch('C2', 'G4', 'C5', 'Eb5'),
  'Eb/w': ch('Eb2', 'G4', 'Bb4', 'Eb5'),
};

const chord = (c: string): string => CH[c].tones.join('+');

/** Pizzicato / pluck 8ths over the chord: low, top, middle, top (twice). */
function pluck8(c: string): string {
  const [a, b, d] = CH[c].tones;
  return mel(`${a}_2 ${d}_2 ${b}_2 ${d}_2 ${a}_2 ${d}_2 ${b}_2 ${d}_2`);
}

/** Pizzicato on the beat only (the queue's patient steps). */
function pluck4(c: string): string {
  const [a, b, d] = CH[c].tones;
  return mel(`${a}_4 ${b}_4 ${d}_4 ${b}_4`);
}

/** A plucky bass: root, root, fifth, root, octave, fifth. */
function bassPluck(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  const f = up(r, 7);
  return mel(`${r}_4 ${r}_2 ${f}_2 ${r}_4 ${o}_2 ${f}_2`);
}

/** Half notes: root, fifth. */
function bassHalf(c: string): string {
  const r = CH[c].root;
  return mel(`${r}/8 ${up(r, 7)}/8`);
}

/** Running 8ths with an octave pop. */
function bassRun(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  return mel(`${r}_2 ${r}_2 ${o}_2 ${r}_2 ${r}_2 ${r}_2 ${o}_2 ${up(r, 7)}_2`);
}

/** The neon bass: pulsing 8ths that alternate root and octave. */
function bassPulse(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  return mel(`${r}_2 ${o}_2 ${r}_2 ${o}_2 ${r}_2 ${o}_2 ${r}_2 ${o}_2`);
}

/** The funk bass: syncopated octave pops. */
function bassFunk(c: string): string {
  const r = CH[c].root;
  const o = up(r, 12);
  return mel(`${r}_3 ${o}_1 . ${r}_2 ${r}_1 ${o}_2 ${up(r, 7)}_2 ${up(r, 10)}_2 ${o}_2`);
}

/** Held chord, one bar (a repeat of the previous bar holds on). */
function held(chords: readonly string[]): string {
  return join(chords.map((c, i) => (i > 0 && chords[i - 1] === c ? '-/16' : `${chord(c)}/16`)));
}

/** Slow arpeggio in 8ths up and down the chord, an octave up. */
function arp8(c: string): string {
  const [a, b, d] = CH[c].tones.map((n) => up(n, 12));
  return mel(`${a}_2 ${b}_2 ${d}_2 ${b}_2 ${a}_2 ${b}_2 ${d}_2 ${b}_2`);
}

/** Off-beat stabs (brass or clav). */
function offStabs(c: string): string {
  const x = chord(c);
  return mel(`./2 ${x}_2 ./2 ${x}_2 ./2 ${x}_2 ./2 ${x}_2`);
}

/** The chase's brass hits: on 1, the "and" of 2, and 4. */
function chaseStabs(c: string): string {
  const x = chord(c);
  return mel(`${x}_3 ./3 ${x}_2 ./4 ${x}_4`);
}

/** The funk clav: a 16th-note chop on the chord. */
function clav(c: string): string {
  const x = chord(c);
  return mel(`./2 ${x}_1 ${x}_1 ./2 ${x}_2 ./2 ${x}_1 ${x}_1 ./2 ${x}_2`);
}

// ---------------------------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------------------------

/** A wooden marimba: a sine bar with a short, bright 4th partial. */
const MARIMBA: InstrumentDef = { kind: 'fm', env: { a: 0.001, d: 0.55, s: 0, r: 0.15 }, vol: 0.32, fm: { ratio: 4, index: 1.3, decay: 0.06 }, oneShot: true };

/** Pizzicato strings: a plucked saw whose filter snaps shut. */
const PIZZ: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.16, s: 0, r: 0.06 }, vol: 0.2, detune: 8, filter: { type: 'lowpass', freq: 1500, q: 0.9, env: 2.2 } };

/** A glockenspiel. */
const GLOCK: InstrumentDef = { kind: 'fm', env: { a: 0.001, d: 0.9, s: 0, r: 0.3 }, vol: 0.14, fm: { ratio: 3.5, index: 2.2, decay: 0.12 }, oneShot: true };

/** The plucky bass. */
const PLUCK_BASS: InstrumentDef = { kind: 'triangle', env: { a: 0.002, d: 0.18, s: 0.3, r: 0.05 }, vol: 0.42 };

/** A sneaky reed lead (a clarinet-ish hollow pulse with a late vibrato). */
const REED: InstrumentDef = {
  kind: 'pulse',
  duty: 0.5,
  env: { a: 0.02, d: 0.1, s: 0.75, r: 0.08 },
  vol: 0.15,
  vibrato: { rate: 5.5, depth: 12, delay: 0.2 },
  filter: { type: 'lowpass', freq: 1900, q: 0.8 },
};

/** The shop bell: a small brass bell. */
const SHOP_BELL: InstrumentDef = { kind: 'fm', env: { a: 0.001, d: 1.2, s: 0, r: 0.3 }, vol: 0.12, fm: { ratio: 2.76, index: 3, decay: 0.2 }, oneShot: true };

/** A clean, guitar-like pluck (the golden afternoon). */
const GUITAR: InstrumentDef = { kind: 'pulse', duty: 0.25, env: { a: 0.002, d: 0.3, s: 0.15, r: 0.1 }, vol: 0.16, filter: { type: 'lowpass', freq: 2200, q: 0.7, env: 1.6 } };

/** A lazy whistle (the afternoon tune). */
const WHISTLE: InstrumentDef = { kind: 'sine', env: { a: 0.04, d: 0.15, s: 0.8, r: 0.2 }, vol: 0.2, vibrato: { rate: 5, depth: 14, delay: 0.25 }, glide: 0.05 };

/** A soft warm pad. */
const SOFT_PAD: InstrumentDef = { kind: 'pad', env: { a: 0.4, d: 0.5, s: 0.7, r: 0.8 }, vol: 0.1, detune: 12, filter: { type: 'lowpass', freq: 1300, q: 0.7 } };

/** Brass stabs: bright detuned saws whose filter snaps open. */
const BRASS: InstrumentDef = { kind: 'saw', env: { a: 0.01, d: 0.12, s: 0.45, r: 0.08 }, vol: 0.14, detune: 12, filter: { type: 'lowpass', freq: 1800, q: 1, env: 2.2 } };

/** The brass lead of the chase. */
const BRASS_LEAD: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.02, d: 0.15, s: 0.75, r: 0.1 },
  vol: 0.22,
  detune: 8,
  vibrato: { rate: 5.8, depth: 16, delay: 0.2 },
  filter: { type: 'lowpass', freq: 2600, q: 1.1, env: 1.6 },
};

/** The running bass of the chase. */
const RUN_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.1, s: 0.5, r: 0.04 }, vol: 0.24, filter: { type: 'lowpass', freq: 800, q: 2, env: 2.4 } };

/** The neon bass: a round saw with a pumping filter. */
const NEON_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.003, d: 0.12, s: 0.45, r: 0.05 }, vol: 0.26, detune: 6, filter: { type: 'lowpass', freq: 520, q: 2.4, env: 3 } };

/** The neon arpeggio: a thin pulse. */
const NEON_ARP: InstrumentDef = { kind: 'pulse', duty: 0.25, env: { a: 0.002, d: 0.14, s: 0.2, r: 0.12 }, vol: 0.13, filter: { type: 'lowpass', freq: 3000, q: 0.8 } };

/** The wide night pad. */
const NEON_PAD: InstrumentDef = { kind: 'pad', env: { a: 0.6, d: 0.8, s: 0.75, r: 1.2 }, vol: 0.12, detune: 22, filter: { type: 'lowpass', freq: 1600, q: 0.8 } };

/** The neon lead: a saw with a slow vibrato and a glide. */
const NEON_LEAD: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.03, d: 0.2, s: 0.7, r: 0.3 },
  vol: 0.19,
  detune: 10,
  vibrato: { rate: 4.8, depth: 18, delay: 0.3 },
  glide: 0.08,
  filter: { type: 'lowpass', freq: 2400, q: 1.2, env: 1.5 },
};

/** The funk clav: a short bright pulse. */
const CLAV: InstrumentDef = { kind: 'pulse', duty: 0.125, env: { a: 0.001, d: 0.08, s: 0.2, r: 0.03 }, vol: 0.16, filter: { type: 'lowpass', freq: 3200, q: 2, env: 1.8 } };

/** The cocky lead: a wah-ish saw (the filter sweeps open on every note). */
const WAH: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.006, d: 0.18, s: 0.6, r: 0.06 },
  vol: 0.21,
  vibrato: { rate: 6, depth: 10, delay: 0.25 },
  filter: { type: 'bandpass', freq: 900, q: 2.5, env: 2.6 },
};

/** The funk bass. */
const FUNK_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.09, s: 0.4, r: 0.03 }, vol: 0.28, filter: { type: 'lowpass', freq: 700, q: 2.6, env: 2.6 } };

/** The waltz's tuba: a round, heavy low tone. */
const TUBA: InstrumentDef = { kind: 'triangle', env: { a: 0.02, d: 0.2, s: 0.6, r: 0.08 }, vol: 0.46, filter: { type: 'lowpass', freq: 500, q: 0.8 } };

/** The waltz's "pah" chords: a reedy accordion-like pulse. */
const ACCORDION: InstrumentDef = { kind: 'pulse', duty: 0.35, env: { a: 0.01, d: 0.1, s: 0.6, r: 0.05 }, vol: 0.1, detune: 14, tremolo: { rate: 6, depth: 0.15 }, filter: { type: 'lowpass', freq: 2000, q: 0.7 } };

/** The waltz's menacing tune: a dark organ-like saw. */
const DARK_LEAD: InstrumentDef = { kind: 'saw', env: { a: 0.03, d: 0.2, s: 0.75, r: 0.15 }, vol: 0.19, detune: 9, vibrato: { rate: 5, depth: 12, delay: 0.3 }, filter: { type: 'lowpass', freq: 1700, q: 1 } };

// ---------------------------------------------------------------------------------------------
// Drums: the clock, the till and the coins (music only; the sampled songs replace the whole mix)
// ---------------------------------------------------------------------------------------------

/** A high wood tick (the noon clock). */
defineSfx('drum/oat-tick', {
  vol: 0.6,
  layers: [
    { wave: 'triangle', freq: 1900, to: 1700, sweep: 0.02, env: { a: 0.0005, d: 0.035 }, vol: 0.8 },
    { wave: 'noise', env: { a: 0.0005, d: 0.01 }, vol: 0.4, filter: { type: 'bandpass', freq: 3500, q: 1.5 } },
  ],
});

/** A lower wood tock. */
defineSfx('drum/oat-tock', {
  vol: 0.6,
  layers: [
    { wave: 'triangle', freq: 1250, to: 1150, sweep: 0.02, env: { a: 0.0005, d: 0.045 }, vol: 0.8 },
    { wave: 'noise', env: { a: 0.0005, d: 0.012 }, vol: 0.35, filter: { type: 'bandpass', freq: 2500, q: 1.5 } },
  ],
});

/** A cash register's ka-ching: the drawer's clack and a bell. */
defineSfx('drum/oat-till', {
  vol: 0.55,
  layers: [
    { wave: 'square', freq: 700, to: 420, env: { a: 0.0005, d: 0.03 }, vol: 0.5, filter: { type: 'lowpass', freq: 4000 } },
    { wave: 'noise', env: { a: 0.0005, d: 0.03 }, vol: 0.5, filter: { type: 'bandpass', freq: 1800, q: 1.4 } },
    { wave: 'sine', freq: 1760, env: { a: 0.001, d: 0.45 }, vol: 0.45, delay: 0.04, fm: { ratio: 2.76, index: 3, decay: 0.08 } },
  ],
});

/** A coin dropped on a counter (the strut's off-beat and the waltz's jingle). */
defineSfx('drum/oat-coin', {
  vol: 0.5,
  layers: [
    { wave: 'sine', freq: 3300, env: { a: 0.0005, d: 0.12 }, vol: 0.5, fm: { ratio: 1.5, index: 1.2, decay: 0.03 } },
    { wave: 'sine', freq: 4700, env: { a: 0.0005, d: 0.06 }, vol: 0.25 },
    { wave: 'noise', env: { a: 0.0005, d: 0.008 }, vol: 0.3, filter: { type: 'highpass', freq: 5000 } },
  ],
});

/** Kit letters: x tick, y tock, q till, n coin, z shaker, d ride, m timpani (+ the default k s h o c t p r). */
const OAT_KIT: Readonly<Record<string, string>> = { x: 'drum/oat-tick', y: 'drum/oat-tock', q: 'drum/oat-till', n: 'drum/oat-coin', z: 'drum/shaker', d: 'drum/ride', m: 'drum/timpani' };

// ---------------------------------------------------------------------------------------------
// oat-a — DE 9 STRAATJES, the bright morning (G major, 116 bpm)
// ---------------------------------------------------------------------------------------------

const A_A = ['G', 'D', 'Em', 'C', 'G', 'C', 'Am', 'D'];
const A_B = ['C', 'G', 'D', 'Em', 'C', 'G', 'Am', 'D'];
const A_C = ['Em', 'C', 'G', 'D', 'Em', 'C', 'A', 'D'];

const A_TUNE_A = bars(
  'G5/2 B5/2 D6/4 B5/2 G5/2 A5/4 | F#5/4 A5/4 D5/8 | E5/2 G5/2 B5/4 A5/2 G5/2 E5/4 | G5/12 ./4 |' +
    'B5/2 D6/2 G6/4 F#6/2 E6/2 D6/4 | E6/4 C6/4 G5/8 | A5/2 C6/2 E6/4 D6/2 C6/2 A5/4 | F#5/8 A5/4 D6/4',
);
const A_TUNE_B = bars(
  'E6/6 D6/2 C6/4 G5/4 | D6/6 B5/2 G5/8 | A5/2 B5/2 C6/2 D6/2 F#6/4 E6/4 | G6/8 E6/4 B5/4 |' +
    'E6/6 D6/2 C6/4 G5/4 | D6/6 B5/2 G5/4 D6/4 | C6/4 B5/4 A5/4 C6/4 | D6/12 ./4',
);
const A_TUNE_C = bars(`${REST} | ${REST} | ${REST} | ${REST} | E5/2 G5/2 B5/4 ./8 | C6/2 E6/2 G6/4 ./8 | A5/2 C#6/2 E6/4 ./8 | F#5/4 A5/4 C6/4 D6/4`);

const A_DR = 'k . z . p . z . k . z k p . z z';
const A_DR_C = 'k+c . z . p . z . k . z k p . z z';
const A_FILL = 'k . z . p . z . k . p . p p P P';
const A_HOOK = 'k . h . p . h k k . h . p . h h';
const A_BREAK = 'z . z . p . z . z . z . p . z p';

const OAT_A_SONG: SongDef = {
  bpm: 116,
  rowsPerBeat: 4,
  // Mix level: about the oldenzaal and ams songs' loudness (≈ −20 dB RMS through Web Audio, peaks
  // below 0.9; measured by the listen-proof render, tmp/oat-lead/audio-listen/render.ts).
  vol: 1.15,
  order: ['intro', 'A', 'B', 'C'],
  loop: 1,
  channels: [
    { inst: MARIMBA, vol: 1, pan: 0.15, patterns: { intro: join(['D5/2 G5/2 B5/4 ./8', 'D6/4 B5/4 A5/4 F#5/4']), A: A_TUNE_A, B: A_TUNE_B, C: A_TUNE_C } },
    { inst: GLOCK, vol: 1, pan: 0.3, patterns: { B: A_TUNE_B } },
    { inst: PIZZ, vol: 1, pan: -0.25, patterns: { intro: join([pluck8('G'), pluck8('D')]), A: join(A_A.map(pluck8)), B: join(A_B.map(pluck8)), C: join(A_C.map(pluck8)) } },
    { inst: PLUCK_BASS, vol: 1, patterns: { intro: join([REST, bassPluck('D')]), A: join(A_A.map(bassPluck)), B: join(A_B.map(bassPluck)), C: join(A_C.map(bassHalf)) } },
    {
      inst: 'drums',
      vol: 0.7,
      kit: OAT_KIT,
      patterns: {
        intro: join(['p . . . p . . . p . p . p p p p', A_FILL]),
        A: join([A_DR_C, A_DR, A_DR, A_FILL, A_DR_C, A_DR, A_DR, A_FILL]),
        B: join([A_HOOK.replace('k ', 'k+c '), A_HOOK, A_HOOK, A_FILL, A_HOOK, A_HOOK, A_HOOK, A_FILL]),
        C: join([...times(A_BREAK, 7), A_FILL]),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// oat-b — FORT NEGEN & ZESTIG, the tense noon (D minor, 108 bpm; B: DE RIJ in F major)
// ---------------------------------------------------------------------------------------------

const B_A = ['Dm', 'Dm', 'Gm', 'Gm', 'Bb', 'Gm', 'A', 'A'];
const B_B = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'A'];

const B_TUNE_A2 = bars(
  'D5_2 F5_2 A5/4 G#5_2 A5_2 ./4 | D6/4 C6_2 A5_2 F5/8 | G5_2 Bb5_2 D6/4 C#6_2 D6_2 ./4 | G6/4 F6_2 D6_2 Bb5/8 |' +
    'F5_2 Bb5_2 D6/4 C6_2 Bb5_2 A5/4 | G5/4 Bb5/4 D6/4 Bb5/4 | A5/6 G5/2 F5/4 E5/4 | C#5/8 E5/4 A5/4',
);
const B_TUNE_B = bars('C6/8 A5/8 | G5/8 E5/8 | F5/4 E5/4 D5/4 E5/4 | F5/12 ./4 | A5/8 C6/8 | E6/8 D6/4 C6/4 | D6/4 C6/4 Bb5/4 G5/4 | A5/12 ./4');
/** The shop bell's ding-ding-dong at the top of each half of the queue part. */
const B_BELL = join([mel('A6_2 F6_2 C6/12'), REST, REST, REST, mel('A6_2 F6_2 C6/12'), REST, REST, REST]);

const B_CLOCK = 'x . . . y . . . x . . . y . . .';
const B_DR = 'k . x . y . x . k . x . y . x x';
const B_DR_C = 'k+c . x . y . x . k . x . y . x x';
const B_FILL = 'k . x . y . x . k . s . s s S S';
const B_QUEUE = 'k . . . x . . . y . . . x . . .';
const B_QUEUE_END = 'k . . . x . . . y . y . s:5 s:6 s:7 s:8';

const OAT_B_SONG: SongDef = {
  bpm: 108,
  rowsPerBeat: 4,
  vol: 1.3,
  order: ['intro', 'A', 'A2', 'B', 'B2'],
  loop: 1,
  channels: [
    { inst: REED, vol: 1, pan: 0.15, patterns: { A2: B_TUNE_A2, B: B_TUNE_B } },
    { inst: GLOCK, vol: 1, pan: 0.3, patterns: { B2: B_TUNE_B } },
    { inst: SHOP_BELL, vol: 1, pan: -0.3, patterns: { B: B_BELL, B2: B_BELL } },
    {
      inst: PIZZ,
      vol: 1,
      pan: -0.2,
      patterns: { A: join(B_A.map(pluck8)), A2: join(B_A.map(pluck8)), B: join(B_B.map(pluck4)), B2: join(B_B.map(pluck8)) },
    },
    {
      inst: PLUCK_BASS,
      vol: 1,
      patterns: { intro: join([mel('D2/16'), mel('A1/16')]), A: join(B_A.map(bassHalf)), A2: join(B_A.map(bassPluck)), B: join(B_B.map(bassHalf)), B2: join(B_B.map(bassHalf)) },
    },
    {
      inst: 'drums',
      vol: 0.75,
      kit: OAT_KIT,
      patterns: {
        intro: join([B_CLOCK, B_CLOCK]),
        A: join([B_CLOCK, B_CLOCK, B_DR, B_DR, B_DR, B_DR, B_DR, B_FILL]),
        A2: join([B_DR_C, B_DR, B_DR, B_FILL, B_DR_C, B_DR, B_DR, B_FILL]),
        B: join([...times(B_QUEUE, 7), B_QUEUE_END]),
        B2: join([B_DR_C, B_QUEUE, B_DR, B_QUEUE, B_DR_C, B_QUEUE, B_DR, B_FILL]),
      },
    },
  ],
};

/** The order index of the queue part (DE RIJ): QUEUE-B enters it with `from`. */
export const OAT_B_QUEUE_SLOT = OAT_B_SONG.order.indexOf('B');

// ---------------------------------------------------------------------------------------------
// oat-c — the quay (A, G major, half-time) and the chase (B, E minor), 144 bpm
// ---------------------------------------------------------------------------------------------

const C_A = ['G', 'Bm', 'Em', 'C', 'Am', 'D', 'G', 'D'];
const C_A2 = ['C', 'D', 'Bm', 'Em', 'Am', 'C', 'D', 'D'];
const C_B = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'];
const C_B2 = ['Am', 'C', 'D', 'Em', 'Am', 'C', 'D', 'B'];
const C_B3 = ['C', 'C', 'D', 'D', 'Em', 'Em', 'B', 'B'];

const C_TUNE_A = bars('B5/8 D6/4 B5/4 | A5/8 F#5/8 | G5/6 A5/2 B5/8 | E5/12 ./4 | C6/8 B5/4 A5/4 | F#5/6 G5/2 A5/8 | B5/4 A5/4 G5/8 | A5/12 ./4');
const C_TUNE_A2 = bars('E6/8 D6/4 C6/4 | D6/8 A5/8 | B5/6 C#6/2 D6/8 | G5/12 ./4 | A5/6 B5/2 C6/8 | E6/8 G5/8 | F#5/4 G5/4 A5/4 C6/4 | D6/12 ./4');
const C_TUNE_B = bars(
  'E5/4 G5/2 B5/2 E6/6 D6/2 | B5/4 G5/4 E5/8 | E5/2 G5/2 C6/4 B5/2 C6/2 E6/4 | D6/8 F#5/4 A5/4 |' +
    'E5/4 G5/2 B5/2 E6/6 F#6/2 | G6/4 F#6/4 E6/4 D6/4 | C6/6 D6/2 E6/4 C6/4 | B5/8 D#6/8',
);
const C_TUNE_B2 = bars(
  'A5/4 C6/4 E6/6 D6/2 | C6/4 G5/4 E5/8 | F#5/2 A5/2 D6/4 C6/2 B5/2 A5/4 | B5/12 ./4 |' + 'A5/4 C6/4 E6/6 G6/2 | G6/4 E6/4 C6/8 | D6/4 E6/4 F#6/4 A6/4 | B6/8 F#6/4 D#6/4',
);
const C_TUNE_B3 = bars(`${REST} | ${REST} | ${REST} | ${REST} | E5/4 G5/4 B5/4 E6/4 | G5/4 B5/4 E6/4 G6/4 | F#5/4 A5/4 D#6/4 F#6/4 | B5/16`);

const C_HALF = 'k . h . h . h . r . h . h . h .';
const C_HALF_C = 'k+c . h . h . h . r . h . h . h .';
const C_HALF_FILL = 'k . h . h . h . r . h . t . t t';
const C_DRIVE = 'k . h k s . h . k . h k s . h h';
const C_DRIVE_C = 'k+c . h k s . h . k . h k s . h h';
const C_DRIVE_FILL = 'k . h k s . h . t t t t S S S S';
const C_BUILD = 's . s . s . s . s s s s S S S S';

const C_A_DRUMS = join([C_HALF_C, C_HALF, C_HALF, C_HALF_FILL, C_HALF, C_HALF, C_HALF, C_HALF_FILL]);

const OAT_C_SONG: SongDef = {
  bpm: 144,
  rowsPerBeat: 4,
  vol: 1.2,
  order: ['intro', 'A', 'A2', 'A', 'A2', 'B', 'B2', 'B3'],
  loop: 5,
  channels: [
    { inst: WHISTLE, vol: 1, pan: 0.12, patterns: { A: C_TUNE_A, A2: C_TUNE_A2 } },
    { inst: BRASS_LEAD, vol: 1, pan: 0.1, patterns: { B: C_TUNE_B, B2: C_TUNE_B2, B3: C_TUNE_B3 } },
    {
      inst: GUITAR,
      vol: 1,
      pan: -0.25,
      patterns: { intro: join([pluck8('G'), pluck8('D')]), A: join(C_A.map(pluck8)), A2: join(C_A2.map(pluck8)) },
    },
    { inst: SOFT_PAD, vol: 1, pan: 0.2, patterns: { A: held(C_A), A2: held(C_A2) } },
    {
      inst: BRASS,
      vol: 1,
      pan: -0.2,
      patterns: { B: join(C_B.map(chaseStabs)), B2: join(C_B2.map(chaseStabs)), B3: join(C_B3.map(offStabs)) },
    },
    {
      inst: RUN_BASS,
      vol: 1,
      patterns: {
        intro: join([mel('G1/16'), mel('D2/16')]),
        A: join(C_A.map(bassHalf)),
        A2: join(C_A2.map(bassHalf)),
        B: join(C_B.map(bassRun)),
        B2: join(C_B2.map(bassRun)),
        B3: join(C_B3.map(bassRun)),
      },
    },
    {
      inst: 'drums',
      vol: 0.75,
      kit: OAT_KIT,
      patterns: {
        intro: join(['k . . . . . . . r . . . . . . .', 'k . h . h . h . r . h . t . t t']),
        A: C_A_DRUMS,
        A2: C_A_DRUMS,
        B: join([C_DRIVE_C, C_DRIVE, C_DRIVE, C_DRIVE_FILL, C_DRIVE_C, C_DRIVE, C_DRIVE, C_DRIVE_FILL]),
        B2: join([C_DRIVE_C, C_DRIVE, C_DRIVE, C_DRIVE_FILL, C_DRIVE_C, C_DRIVE, C_DRIVE, C_DRIVE_FILL]),
        B3: join([C_DRIVE_C, C_DRIVE, C_DRIVE, C_DRIVE, C_DRIVE_C, C_DRIVE, C_DRIVE_FILL, C_BUILD]),
      },
    },
  ],
};

/** The order index of the chase (part B): KADE and TAXIRIT enter it with `from` (oat-c1, oat-e). */
export const OAT_C_CHASE_SLOT = OAT_C_SONG.order.indexOf('B');

// ---------------------------------------------------------------------------------------------
// oat-d — DE WALLEN BY NIGHT, the neon synth (C minor, 104 bpm)
// ---------------------------------------------------------------------------------------------

const D_A = ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'G/d'];
const D_B = ['Ab', 'Bb', 'Gm', 'Cm', 'Ab', 'Bb', 'G/d', 'G/d'];
const D_C = ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G/d', 'G/d'];

const D_TUNE_A = bars('G5/8 Eb5/4 G5/4 | C6/12 Bb5/4 | G5/8 Bb5/4 Eb6/4 | D6/12 ./4 | G5/8 Eb5/4 G5/4 | C6/8 Eb6/4 C6/4 | Ab5/6 G5/2 F5/8 | B4/8 D5/4 G5/4');
const D_TUNE_B = bars('Eb6/8 C6/8 | D6/8 F6/8 | G6/12 F6/4 | Eb6/16 | Eb6/8 C6/4 Eb6/4 | F6/8 D6/4 F6/4 | G6/8 F6/4 D6/4 | B5/12 ./4');
/** A2: the A tune an octave up (its peaks folded down), then back down into the late part. */
const D_TUNE_A2 = bars('G6/8 Eb6/4 G6/4 | C7/12 Bb6/4 | G6/8 Bb6/4 G6/4 | D6/4 F6/4 Bb6/8 | G6/8 Eb6/4 G6/4 | C7/8 Bb6/4 Ab6/4 | Ab6/6 G6/2 F6/8 | D6/8 B5/4 G5/4');
/** The late part: one bell per two bars over the pad (C2). */
const D_BELLS = join([mel('G6/16'), REST, mel('Eb6/16'), REST, mel('C6/16'), REST, mel('D6/16'), REST]);

const D_DR = 'k . h . s . h . k . h k s . h .';
const D_DR_C = 'k+c . h . s . h . k . h k s . h .';
const D_FILL = 'k . h . s . h . k . s . s s s s';
const D_SPARSE = '. . h . . . h . . . h . . . h .';
const D_SPARSE_K = 'k . h . . . h . . . h . . . h .';

const OAT_D_SONG: SongDef = {
  bpm: 104,
  rowsPerBeat: 4,
  vol: 1.3,
  order: ['intro', 'A', 'B', 'A2', 'C', 'C2'],
  loop: 1,
  channels: [
    { inst: NEON_LEAD, vol: 1, pan: 0.12, patterns: { A: D_TUNE_A, B: D_TUNE_B, A2: D_TUNE_A2 } },
    { inst: GLOCK, vol: 1, pan: 0.3, patterns: { C2: D_BELLS } },
    {
      inst: NEON_ARP,
      vol: 1,
      pan: -0.3,
      patterns: { intro: join([arp8('Cm'), arp8('G/d')]), A: join(D_A.map(arp8)), B: join(D_B.map(arp8)), A2: join(D_A.map(arp8)), C: join(D_C.map(arp8)), C2: join(D_C.map(arp8)) },
    },
    { inst: NEON_PAD, vol: 1, pan: 0.25, patterns: { intro: join([mel('G4+C5+Eb5/16'), mel('-/16')]), A: held(D_A), B: held(D_B), A2: held(D_A), C: held(D_C), C2: held(D_C) } },
    {
      inst: NEON_BASS,
      vol: 1,
      patterns: { intro: join([REST, bassPulse('G/d')]), A: join(D_A.map(bassPulse)), B: join(D_B.map(bassPulse)), A2: join(D_A.map(bassPulse)), C: join(D_C.map((c) => mel(`${CH[c].root}/16`))) },
    },
    {
      inst: 'drums',
      vol: 0.7,
      kit: OAT_KIT,
      patterns: {
        intro: join([D_SPARSE, 'k . h . s . h . k . s . s s S S']),
        A: join([D_DR_C, D_DR, D_DR, D_FILL, D_DR_C, D_DR, D_DR, D_FILL]),
        B: join([D_DR_C, D_DR, D_DR, D_FILL, D_DR_C, D_DR, D_DR, D_FILL]),
        A2: join([D_DR_C, D_DR, D_DR, D_FILL, D_DR_C, D_DR, D_DR, D_SPARSE]),
        C: join([D_SPARSE_K, D_SPARSE, D_SPARSE_K, D_SPARSE, D_SPARSE_K, D_SPARSE, D_SPARSE_K, D_SPARSE]),
        C2: join([D_SPARSE_K, D_SPARSE, D_SPARSE_K, D_SPARSE, D_SPARSE_K, D_SPARSE, D_SPARSE_K, D_FILL]),
      },
    },
  ],
};

/** The order index of the sparse late part (after 02:00): NIGHT enters it with `from`. */
export const OAT_D_LATE_SLOT = OAT_D_SONG.order.indexOf('C');

// ---------------------------------------------------------------------------------------------
// oat-boss — De Makelaar (A, a cocky strut in A minor, 4/4) and De Huisjesmelker (B, a heavy
// waltz in G minor, 3/4), 132 bpm
// ---------------------------------------------------------------------------------------------

const S_A = ['Am7', 'D7', 'Am7', 'D7', 'Fmaj7', 'E7', 'Am7', 'E7'];
const W_B = ['Gm/w', 'D7/w', 'Gm/w', 'Gm/w', 'Cm/w', 'Gm/w', 'D7/w', 'D7/w', 'Eb/w', 'Cm/w', 'Gm/w', 'Eb/w', 'Cm/w', 'D7/w', 'Gm/w', 'Gm/w'];

const S_TUNE_A = bars(
  'A5_2 C6_2 E6/4 G6_2 E6_2 ./4 | F#6/4 E6_2 D6_2 C6/8 | A5_2 C6_2 E6/4 G6_2 A6_2 ./4 | F#6/2 G6/2 F#6/4 D6/8 |' +
    'E6/4 C6/4 A5/4 C6/4 | B5/4 G#5/4 D6/8 | C6_2 B5_2 A5/4 G5_2 A5_2 ./4 | G#5/8 B5/4 E6/4',
);

/** The waltz tune (16 bars of 12 rows). */
const W_TUNE_B = bars(
  'D5/8 G5/4 | F#5/8 A5/4 | Bb5/4 A5/4 G5/4 | D5/12 | Eb5/8 G5/4 | D5/8 Bb4/4 | C5/4 Bb4/4 A4/4 | F#4/12 |' +
    'G4/8 Bb4/4 | Eb5/8 G5/4 | Bb5/8 A5/4 | G5/8 Eb5/4 | C5/4 Eb5/4 G5/4 | F#5/4 A5/4 C6/4 | Bb5/8 A5/4 | G5/12',
  OAT_WALTZ_BAR,
);

/** Oom: the tuba on 1 (and a fifth on the last beat of every other bar). */
function oom(c: string, i: number): string {
  const r = CH[c].root;
  return i % 2 === 0 ? mel(`${r}/4 ./8`) : mel(`${r}/4 ./4 ${up(r, 7)}_4`);
}

/** Pah-pah: the chord on 2 and 3. */
function pahPah(c: string): string {
  const x = chord(c);
  return mel(`./4 ${x}_2 ./2 ${x}_2 ./2`);
}

const S_DR = 'k . n . p . . k k . n . p . n .';
const S_DR_C = 'k+c . n . p . . k k . n . p . n .';
const S_FILL = 'k . n . p . . k k . p . p p P P';
const S_BREAK = 'k . . . p . . . k . . . p . p .';
const S_BREAK_END = 'k . . . p . . . k . n n n n P P';

const W_DR = 'k . . . s:5 . . . s:5 . . .';
const W_DR_TILL = 'k . . . s:5 . . . q . . .';
const W_DR_COIN = 'k . . . s:5 . n n s:5 . n .';
const W_FILL = 'k . . . s . s . S . S S';

const OAT_BOSS_SONG: SongDef = {
  bpm: 132,
  rowsPerBeat: 4,
  vol: 1.25,
  order: ['intro', 'A', 'A2', 'A+2', 'A2+2', 'Bi', 'B', 'B2'],
  loop: 6,
  channels: [
    { inst: WAH, vol: 1, pan: 0.12, patterns: { A: S_TUNE_A } },
    { inst: DARK_LEAD, vol: 1, pan: 0.1, patterns: { B: W_TUNE_B, B2: shift(W_TUNE_B, 12) } },
    {
      inst: CLAV,
      vol: 1,
      pan: -0.25,
      patterns: { intro: join([clav('Am7'), clav('E7')]), A: join(S_A.map(clav)), A2: join(S_A.map(clav)) },
    },
    { inst: BRASS, vol: 1, pan: 0.25, patterns: { A2: join(S_A.map((c, i) => (i % 2 === 0 ? chaseStabs(c) : REST))) } },
    {
      inst: ACCORDION,
      vol: 1,
      pan: -0.2,
      patterns: { Bi: join([WREST, WREST], OAT_WALTZ_BAR), B: join(W_B.map(pahPah), OAT_WALTZ_BAR), B2: join(W_B.map(pahPah), OAT_WALTZ_BAR) },
    },
    { inst: FUNK_BASS, vol: 1, patterns: { intro: join([bassFunk('Am7'), bassFunk('E7')]), A: join(S_A.map(bassFunk)), A2: join(S_A.map(bassFunk)) } },
    {
      inst: TUBA,
      vol: 1,
      patterns: { Bi: join([mel('G1/12'), mel('D2/4 ./4 D2_4')], OAT_WALTZ_BAR), B: join(W_B.map(oom), OAT_WALTZ_BAR), B2: join(W_B.map(oom), OAT_WALTZ_BAR) },
    },
    {
      inst: 'drums',
      vol: 0.75,
      kit: OAT_KIT,
      patterns: {
        intro: join(['k . n . p . . k k . n . p . n .', 'k . n . p . . k k . p . p p P P']),
        A: join([S_DR_C, S_DR, S_DR, S_FILL, S_DR_C, S_DR, S_DR, S_FILL]),
        A2: join([...times(S_BREAK, 7), S_BREAK_END]),
        Bi: join(['q:5 . . . . . . . q:4 . . .', 'm:2 m:2 m:3 m:3 m:4 m:4 m:5 m:5 s:6 . s:7 .'], OAT_WALTZ_BAR),
        B: join([W_DR, W_DR_TILL, W_DR, W_DR_COIN, W_DR, W_DR_TILL, W_DR, W_FILL, W_DR, W_DR_TILL, W_DR, W_DR_COIN, W_DR, W_DR_TILL, W_DR, W_FILL], OAT_WALTZ_BAR),
        B2: join([W_DR_TILL, W_DR_COIN, W_DR_TILL, W_DR_COIN, W_DR_TILL, W_DR_COIN, W_DR_TILL, W_FILL, W_DR_TILL, W_DR_COIN, W_DR_TILL, W_DR_COIN, W_DR_TILL, W_DR_COIN, W_DR, W_FILL], OAT_WALTZ_BAR),
      },
    },
  ],
};

/** De Makelaar's part (the top of the song). */
export const OAT_BOSS_MAKELAAR_SLOT = 0;
/** De Huisjesmelker's part (the waltz's 2-bar intro, then the waltz loops). */
export const OAT_BOSS_HUISJESMELKER_SLOT = OAT_BOSS_SONG.order.indexOf('Bi');

// ---------------------------------------------------------------------------------------------
// The takes (wave C): the form each ElevenLabs take is asked for, and where each synth slot sits
// ---------------------------------------------------------------------------------------------

/** One part of a take: its name (a synth pattern name), its bars and beats per bar. */
export interface OatTakePart {
  readonly name: string;
  readonly bars: number;
  readonly beatsPerBar: number;
}

/** The form of a song's take: a compact version of the synth form (repeats played once). */
export interface OatTakeForm {
  readonly bpm: number;
  readonly parts: readonly OatTakePart[];
  /** The part the take loops from (to its end). */
  readonly loopFrom: string;
}

const part = (name: string, n: number, beatsPerBar = 4): OatTakePart => ({ name, bars: n, beatsPerBar });

/**
 * The take forms (tools/audio/spec.ts builds the prompts' bar plans and `slotBeats` from them). A
 * synth slot maps to the take part of the same name, else to the part of its base name ('A2+2' →
 * 'A2', 'A+2' → 'A'; a missing 'A2' → 'A').
 */
export const OAT_TAKES: Readonly<Record<string, OatTakeForm>> = {
  'oat-a': { bpm: 116, parts: [part('intro', 2), part('A', 8), part('B', 8), part('C', 8)], loopFrom: 'A' },
  'oat-b': { bpm: 108, parts: [part('intro', 2), part('A', 8), part('A2', 8), part('B', 8), part('B2', 8)], loopFrom: 'A' },
  'oat-c': { bpm: 144, parts: [part('intro', 2), part('A', 8), part('A2', 8), part('B', 8), part('B2', 8), part('B3', 8)], loopFrom: 'B' },
  'oat-d': { bpm: 104, parts: [part('intro', 2), part('A', 8), part('B', 8), part('C', 8), part('C2', 8)], loopFrom: 'A' },
  'oat-boss': { bpm: 132, parts: [part('intro', 2), part('A', 8), part('A2', 8), part('Bi', 2, 3), part('B', 16, 3), part('B2', 16, 3)], loopFrom: 'B' },
};

/** Beats from the top of the take to the start of each of its parts, by part name. */
function partBeats(form: OatTakeForm): Map<string, number> {
  const at = new Map<string, number>();
  let beat = 0;
  for (const p of form.parts) {
    at.set(p.name, beat);
    beat += p.bars * p.beatsPerBar;
  }
  at.set('', beat);
  return at;
}

/** The take's length in beats. */
export function takeBeats(id: string): number {
  return partBeats(OAT_TAKES[id]).get('') ?? 0;
}

/** Beats before the take's loop part. */
export function takeLoopBeat(id: string): number {
  const form = OAT_TAKES[id];
  return partBeats(form).get(form.loopFrom) ?? 0;
}

/** For each slot of the synth song's order, the beat in the take where that part starts. */
export function takeSlotBeats(id: string): number[] {
  const at = partBeats(OAT_TAKES[id]);
  return OAT_SONGS[id].order.map((slot) => {
    const name = slot.replace(/[+-]\d+$/, '');
    const hit = at.get(name) ?? at.get(name.replace(/\d+$/, ''));
    if (hit === undefined) throw new Error(`music/oat: ${id} slot ${slot} has no part in the take`);
    return hit;
  });
}

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** Every song of this module by id (ids.ts `OAT_SONG`; tests parse them). Not part of MISSION_SONGS. */
export const OAT_SONGS: Readonly<Record<string, SongDef>> = {
  'oat-a': OAT_A_SONG,
  'oat-b': OAT_B_SONG,
  'oat-c': OAT_C_SONG,
  'oat-d': OAT_D_SONG,
  'oat-boss': OAT_BOSS_SONG,
};

for (const [id, song] of Object.entries(OAT_SONGS)) defineSong(id, song);
