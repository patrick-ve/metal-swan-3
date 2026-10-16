/**
 * Synth fallbacks of the first-person mode's songs (docs/design/fps.md §9.2). The ElevenLabs takes
 * of group 'mode:fps' replace them when loaded; their tempo, key and form match the take specs in
 * tools/audio/spec.ts, so a take and its fallback feel the same. Every note was composed for
 * METAL SWAN 3 (docs/ORIGINALITY.md): no melody, bass line or arrangement is taken from any
 * existing tune, and nothing from the reference game of the genre.
 *
 * - `fps-floor` — a brooding martial ostinato in C minor, 100 bpm, one 32-bar loop (76.8 s) with
 *   no intro: A (ostinato, low brass pad, bass drum on 1 and 3) → B (snare march, a low horn
 *   line) → C (bars 17–24: a sparse muted-trumpet motif answers the ostinato) → D (it builds back:
 *   timpani, rolls, the horn line doubled an octave up) → loop to A.
 * - `fps-boss` — MechaHitler: D minor, 140 bpm. A 2-bar timpani roll, then the 32-bar loop
 *   (54.9 s): A (galloping bass, organ stabs on the off-beats) → B (the lead's theme) → C × 4,
 *   each 4 bars a step higher (D, E, F, G minor; the last ends on a D major chord) → loop to A.
 * - `fps-tally` — a short brass victory jingle in C major, 120 bpm, 4 bars (8 s), no loop.
 * - `fps-bridge` — 60 bpm. A 4-s sting: our own ams street-organ figure stutters like a broken
 *   tape and slides down into a low C drone; then a 4-bar (16 s) drone loop with a slow pulse, a
 *   metallic hum and faint digital crackle under the story card.
 */
import { defineSong } from '../../../engine/audio';
import type { InstrumentDef, SongDef } from '../../../engine/music';
import { DRIVE_BASS, harmonize, KIT, measures, ORGAN, rep, transpose } from '../music/index';

// ---------------------------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------------------------

/** Staccato string-and-synth ostinato: a short saw with a filter that snaps open on every note. */
const OSTINATO: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.003, d: 0.11, s: 0.18, r: 0.05 },
  vol: 0.24,
  detune: 6,
  filter: { type: 'lowpass', freq: 850, q: 2, env: 2.2 },
};

/** The low brass pad: three detuned saws, a slow swell, dark. */
const BRASS_PAD: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.4, d: 0.5, s: 0.8, r: 0.5 },
  vol: 0.12,
  detune: 8,
  filter: { type: 'lowpass', freq: 1000, q: 0.9 },
};

/** A low horn: a soft saw with a late vibrato. */
const HORN: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.06, d: 0.3, s: 0.75, r: 0.25 },
  vol: 0.2,
  vibrato: { rate: 5, depth: 8, delay: 0.3 },
  filter: { type: 'lowpass', freq: 1300, q: 1, env: 1.4 },
};

/** A muted trumpet: a thin pulse through a narrow band, a slow vibrato. */
const MUTED_TRUMPET: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.02, d: 0.2, s: 0.65, r: 0.15 },
  vol: 0.3,
  vibrato: { rate: 5.5, depth: 12, delay: 0.25 },
  filter: { type: 'bandpass', freq: 1300, q: 1.1 },
};

/** Round low bass. */
const LOW_BASS: InstrumentDef = {
  kind: 'triangle',
  env: { a: 0.004, d: 0.2, s: 0.7, r: 0.08 },
  vol: 0.42,
};

/** The boss's organ stab: short, bright, detuned. */
const BOSS_STAB: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.004, d: 0.1, s: 0.35, r: 0.06 },
  vol: 0.17,
  detune: 9,
  filter: { type: 'lowpass', freq: 2800, q: 1 },
};

/** The boss's lead: a gritty saw with a fast vibrato (guitar and brass in one). */
const BOSS_LEAD: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.006, d: 0.22, s: 0.7, r: 0.1 },
  vol: 0.24,
  detune: 10,
  vibrato: { rate: 6.2, depth: 16, delay: 0.18 },
  filter: { type: 'lowpass', freq: 2600, q: 1.6, env: 1.8 },
};

/** A bold fanfare brass. */
const BRASS: InstrumentDef = {
  kind: 'saw',
  env: { a: 0.012, d: 0.15, s: 0.7, r: 0.2 },
  vol: 0.24,
  detune: 6,
  vibrato: { rate: 5.5, depth: 10, delay: 0.25 },
  filter: { type: 'lowpass', freq: 2200, q: 1.1, env: 1.6 },
};

/** The street organ's "pah" chords (bridge sting). */
const PAH: InstrumentDef = {
  kind: 'pulse',
  duty: 0.25,
  env: { a: 0.004, d: 0.1, s: 0.4, r: 0.05 },
  vol: 0.08,
  filter: { type: 'lowpass', freq: 1700, q: 0.8 },
};

/** The broken tape: the organ voice with a long glide, so `~` slides fall like a tape stopping. */
const TAPE: InstrumentDef = { ...ORGAN, glide: 0.36, env: { a: 0.02, d: 0.3, s: 0.9, r: 0.4 } };

/** The drone: a slow-swelling dark pad (re-struck every bar: the slow pulse). */
const DRONE: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.9, d: 0.8, s: 0.75, r: 1.2 },
  vol: 0.16,
  detune: 10,
  filter: { type: 'lowpass', freq: 600, q: 1.2 },
};

/** A distant metallic hum: a low FM tone with an inharmonic modulator. */
const HUM: InstrumentDef = {
  kind: 'fm',
  env: { a: 1.2, d: 1, s: 0.7, r: 1.5 },
  vol: 0.07,
  fm: { ratio: 1.41, index: 1.2, decay: 3 },
  tremolo: { rate: 0.5, depth: 0.4 },
};

/** A soft sub thump for the drone's heartbeat. */
const THUMP: InstrumentDef = {
  kind: 'sine',
  env: { a: 0.005, d: 0.35, s: 0, r: 0.1 },
  vol: 0.4,
  oneShot: true,
};

// ---------------------------------------------------------------------------------------------
// fps-floor — C minor, 100 bpm, 32 bars
// ---------------------------------------------------------------------------------------------

/** Per chord: [ostinato root, minor/major third, fifth below, colour note, bass root, pad chord]. */
const FCH: Readonly<Record<string, readonly [string, string, string, string, string, string]>> = {
  Cm: ['C3', 'Eb3', 'G2', 'D3', 'C2', 'C3+Eb3+G3'],
  Ab: ['Ab2', 'C3', 'Eb2', 'Bb2', 'Ab1', 'Ab2+C3+Eb3'],
  Fm: ['F3', 'Ab3', 'C3', 'G3', 'F2', 'F2+Ab2+C3'],
  G: ['G2', 'B2', 'D2', 'Ab2', 'G1', 'G2+B2+D3'],
};

/** One bar of the martial ostinato: eighths with a double on 2 and 4 ("dun da-da dun dun"). */
function ost(c: string): string {
  const [r, m, f, n] = FCH[c];
  return `${r}_2 ${r} ${r} ${m}_2 ${r}_2 ${f}_2 ${r} ${r} ${n}_2 ${m}_2`;
}

/** Bass: a long root on 1, a short root and a held one on 3. */
function floorBass(c: string): string {
  const b = FCH[c][4];
  return `${b}/6 ./2 ${b}_2 ${b}/4 ./2`;
}

/** Pad chords: a new chord re-strikes, the same chord is held over the bar line. */
function padOf(chords: readonly string[]): string {
  return measures(chords.map((c, i) => (i > 0 && chords[i - 1] === c ? '-/16' : `${FCH[c][5]}/16`)).join(' | '));
}

const FA = ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'];
const FB = ['Cm', 'Ab', 'Cm', 'Ab', 'Fm', 'Ab', 'G', 'G'];
const FC = ['Cm', 'G', 'Cm', 'Ab', 'Cm', 'G', 'G', 'Cm'];
const FD = FB;

/** B: the low horn line (the D section doubles it an octave up). */
const HORN_LINE = measures('Eb4/16 | C4/8 Eb4/8 | G4/16 | Ab4/8 G4/8 | F4/12 Ab4/4 | C5/8 Eb4/8 | D4/16 | B3/12 ./4');

/** C (bars 17–24): the muted trumpet answers the ostinato in short calls. */
const TRUMPET_C = measures(
  './8 G4/3 G4 C5/4 | B4/6 Ab4/2 G4/8 | ./8 Eb4/3 F4 G4/4 | Ab4/12 ./4 |' + './8 G4/3 G4 Eb5/4 | D5/6 C5/2 B4/4 G4/4 | D5/4 F5/4 Eb5/4 B4/4 | C5/12 ./4',
);

const F_KICK = 'k . . . s:3 . . . k . . . s:3 . . .';
const F_KICK_UP = 'k . . . s:3 . . . k . s:3 s:3 s:4 s:5 s:6 s:7';
const F_MARCH = 'k . s:3 s:3 S . s:3 . k . s:3 s:3 S . s:4 s:4';
const F_ROLL = 'k . s:3 s:3 S . s:3 . s:4 s:4 s:5 s:5 s:6 s:6 s:7 s:8';
const F_SPARSE = 'k+m:5 . . . . . . . k . . . . . . .';
const F_SPARSE_UP = 'k+m:5 . . . . . . . k . . . m:4 . m:5 .';
const F_BUILD = 'k+m:5 . s:3 s:3 s:8 . s:3 . k+m:4 . s:3 s:3 s:8 . s:4 s:4';
const F_BIG_ROLL = 's:4 s:4 s:4 s:5 s:5 s:5 s:6 s:6 s:6 s:7 s:7 s:7 s:8 s:8 s:8 s:9';

const FPS_FLOOR: SongDef = {
  bpm: 100,
  rowsPerBeat: 4,
  // Mix level: matched to `ams` by the audio report (≈ −18 LUFS integrated, like `ams`).
  vol: 1.2,
  order: ['A', 'B', 'C', 'D'],
  loop: 0,
  channels: [
    // The ostinato (lighter in C, where the trumpet speaks).
    {
      inst: OSTINATO,
      vol: 1,
      pan: -0.15,
      patterns: {
        A: measures(FA.map(ost).join(' | ')),
        B: measures(FB.map(ost).join(' | ')),
        C: measures(FC.map(ost).join(' | ')),
        D: measures(FD.map(ost).join(' | ')),
      },
    },
    { inst: BRASS_PAD, vol: 1, pan: 0.15, patterns: { A: padOf(FA), B: padOf(FB), C: padOf(FC), D: padOf(FD) } },
    {
      inst: LOW_BASS,
      vol: 0.9,
      patterns: {
        A: measures(FA.map(floorBass).join(' | ')),
        B: measures(FB.map(floorBass).join(' | ')),
        C: measures(FC.map(floorBass).join(' | ')),
        D: measures(FD.map(floorBass).join(' | ')),
      },
    },
    { inst: HORN, vol: 0.9, pan: 0.25, patterns: { B: HORN_LINE, D: HORN_LINE } },
    { inst: MUTED_TRUMPET, vol: 0.9, pan: 0.3, patterns: { C: TRUMPET_C, D: transpose(HORN_LINE, 12) } },
    {
      inst: 'drums',
      vol: 0.55,
      kit: KIT,
      patterns: {
        A: measures([F_KICK, F_KICK, F_KICK, F_KICK_UP, F_KICK, F_KICK, F_KICK, F_KICK_UP].join(' | ')),
        B: measures([F_MARCH, F_MARCH, F_MARCH, F_ROLL, F_MARCH, F_MARCH, F_MARCH, F_ROLL].join(' | ')),
        C: measures([F_SPARSE, F_SPARSE, F_SPARSE, F_SPARSE_UP, F_SPARSE, F_SPARSE, F_SPARSE, F_KICK_UP].join(' | ')),
        D: measures([F_BUILD, F_BUILD, F_BUILD, F_ROLL, F_BUILD, F_BUILD, F_ROLL, F_BIG_ROLL].join(' | ')),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// fps-boss — D minor, 140 bpm, 2 + 32 bars
// ---------------------------------------------------------------------------------------------

/** Per chord: [bass root, octave, fifth, stab chord]. */
const BCH: Readonly<Record<string, readonly [string, string, string, string]>> = {
  Dm: ['D2', 'D3', 'A2', 'D4+F4+A4'],
  Bb: ['Bb1', 'Bb2', 'F2', 'D4+F4+Bb4'],
  Gm: ['G1', 'G2', 'D2', 'D4+G4+Bb4'],
  A: ['A1', 'A2', 'E2', 'C#4+E4+A4'],
  F: ['F2', 'F3', 'C3', 'C4+F4+A4'],
};

/** One bar of the gallop: "da-ga-dum" on every beat, an octave jump on 2 and 4, the fifth last. */
function gallop(c: string): string {
  const [r, o, f] = BCH[c];
  return [r, '.', r, r, o, '.', r, r, r, '.', r, r, o, '.', f, f].join(' ');
}

/** Organ stabs on the off-beats ("and" of every beat). */
function offStabs(c: string): string {
  const x = BCH[c][3];
  return `. . ${x} . . . ${x} . . . ${x} . . . ${x} .`;
}

const BA2 = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'];
const BB2 = ['Dm', 'F', 'Gm', 'A', 'Dm', 'Gm', 'A', 'Dm'];
const BC2 = ['Dm', 'Dm', 'Bb', 'A'];

/** A: the lead waits, then climbs in over the dominant. */
const LEAD_A = measures('./16 | ./16 | ./16 | ./16 | G4/4 Bb4/4 D5/8 | C5/4 Bb4/4 A4/4 G4/4 | A4/4 C#5/4 E5/8 | G5/4 F5/4 E5/4 C#5/4');

/** B: the theme. */
const LEAD_B = measures(
  'D5/4 A4/2 D5/2 F5/4 E5/4 | D5/6 C5/2 A4/8 | Bb4/4 C5/2 D5/2 F5/4 G5/4 | A5/12 ./4 |' + 'A5/4 G5/2 F5/2 G5/4 A5/4 | Bb5/6 A5/2 G5/4 F5/4 | E5/4 F5/4 G5/4 C#5/4 | D5/12 ./4',
);

/** C: four bars that the order list plays a step higher each time. */
const LEAD_C = measures('D5/2 E5/2 F5/4 A5/8 | G5/2 F5/2 E5/4 D5/8 | F5/4 Bb5/4 D6/8 | C#6/8 E5/4 A5/4');

const B_ROCK = 'k+m . h . s . h . k . k h s . h h';
const B_ROCK_CRASH = 'k+c . h . s . h . k . k h s . h h';
const B_FILL = 'k+m . h . s . h . s:5 s:6 s:6 s:7 s:7 s:8 S S';
const B_POUND = 'k+m . h k s+m . h . k+m k h . s+m . h h';
const B_POUND_FILL = 'k+m . h k s+m . h . m:6 m:6 m:7 m:7 s:7 s:8 S S';
const B_TIMP_ROLL = measures(
  'm:1 m:1 m:1 m:2 m:2 m:2 m:2 m:3 m:3 m:3 m:3 m:4 m:4 m:4 m:4 m:5 | m:5 m:5 m:6 m:6 m:6 m:7 m:7 m:7 m:8 m:8 m:8 m:9 M M S S',
);

const FPS_BOSS: SongDef = {
  bpm: 140,
  rowsPerBeat: 4,
  // Mix level: matched to `ams-boss` by the audio report (≈ −18 LUFS integrated).
  vol: 0.8,
  order: ['intro', 'A', 'B', 'C', 'C+2', 'C+3', 'C+5'],
  loop: 1,
  channels: [
    { inst: BOSS_LEAD, vol: 1, pan: 0.1, patterns: { A: LEAD_A, B: LEAD_B, C: LEAD_C } },
    // The lead's shadow a third below in the climb (C), for weight.
    { inst: BOSS_LEAD, vol: 0.45, pan: -0.25, patterns: { C: harmonize(LEAD_C, 5, -2) } },
    {
      inst: BOSS_STAB,
      vol: 1,
      pan: -0.15,
      patterns: {
        A: measures(BA2.map(offStabs).join(' | ')),
        B: measures(BB2.map(offStabs).join(' | ')),
        C: measures(BC2.map(offStabs).join(' | ')),
      },
    },
    {
      inst: DRIVE_BASS,
      vol: 1,
      patterns: {
        intro: measures('D2/16 | -/16'),
        A: measures(BA2.map(gallop).join(' | ')),
        B: measures(BB2.map(gallop).join(' | ')),
        C: measures(BC2.map(gallop).join(' | ')),
      },
    },
    {
      inst: 'drums',
      vol: 0.8,
      kit: KIT,
      patterns: {
        intro: B_TIMP_ROLL,
        A: measures([B_ROCK_CRASH, ...rep(B_ROCK, 6), B_FILL].join(' | ')),
        B: measures([B_ROCK_CRASH, ...rep(B_ROCK, 6), B_FILL].join(' | ')),
        C: measures([B_POUND, B_POUND, B_POUND, B_POUND_FILL].join(' | ')),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// fps-tally — C major, 120 bpm, 4 bars, no loop
// ---------------------------------------------------------------------------------------------

const TALLY_LEAD = measures('G4/3 C5 C5/2 E5/2 G5/6 ./2 | F5/3 A5 A5/2 G5/2 E5/6 ./2 | A4/2 B4/2 C5/2 D5/2 E5/2 F5/2 G5/2 B5/2 | C6/12 ./4');

const FPS_TALLY: SongDef = {
  bpm: 120,
  rowsPerBeat: 4,
  // Mix level: matched to `mission-complete` by the audio report.
  vol: 1.0,
  order: ['A'],
  loop: null,
  channels: [
    { inst: BRASS, vol: 1, pan: 0.1, patterns: { A: TALLY_LEAD } },
    { inst: BRASS, vol: 0.55, pan: -0.2, patterns: { A: harmonize(TALLY_LEAD, 0, -2) } },
    { inst: BRASS_PAD, vol: 1.1, patterns: { A: measures('C4+E4+G4/16 | C4+F4+A4/16 | B3+D4+G4/16 | C4+E4+G4+C5/12 ./4') } },
    { inst: LOW_BASS, vol: 0.9, patterns: { A: measures('C2/8 G2/8 | F2/8 C3/8 | G2/4 G2/4 G2/4 G1/4 | C2/12 ./4') } },
    {
      inst: 'drums',
      vol: 0.7,
      kit: KIT,
      patterns: {
        A: measures(
          'k+m . . . s:4 . . . k+m . . . s:4 . s:4 . | k+m . . . s:4 . . . k+m . . . s:4 . s:4 . |' +
            's:4 s:4 s:5 s:5 s:5 s:6 s:6 s:6 s:7 s:7 s:7 s:8 s:8 S S S | k+c+m . . . . . . . . . . . . . . .',
        ),
      },
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// fps-bridge — 60 bpm, 8 rows per beat: a 1-bar sting (4 s) and a 4-bar drone loop (16 s)
// ---------------------------------------------------------------------------------------------

/** Rows per 4/4 bar at 8 rows per beat. */
const BRIDGE_BAR = 32;
const bbar = (s: string): string => measures(s, BRIDGE_BAR);

/**
 * The sting: the opening of our own ams street-organ tune (A–C–F, then the turn E–F–D) starts at
 * its own speed, skips on E–F like a stuck tape, stutters on F, then the tape voice falls away.
 */
const STING_ORGAN = bbar('A4/2 C5 F5/5 E5/2 F5 E5 F5 E5 F5 F5 F5 . F5 ./13');
const STING_TAPE = bbar('./18 D5/2 ~A4/3 ~F4/3 ~C4/3 ~C3/3');
const STING_PAH = bbar('F2 . . A3+C4+F4 . . A3+C4+F4 . . . C2 . . Bb3+C4+E4 . Bb3+C4+E4 Bb3+C4+E4 Bb3+C4+E4 ./14');
const STING_GLITCH = bbar('./10 g:4 . . g:5 . g:6 g:5 . g:7 . g g:6 . G . . g:5 . G . m:5 .');

/** The drone: a low C fifth re-struck every bar (the slow pulse), a heartbeat every 2 s. */
const DRONE_PAD = bbar('C2+G2/32 | C2+G2/32 | C2+G2/32 | C2+G2/32');
const DRONE_HUM = bbar('F#3/32 | -/30 ./2 | F#3/32 | -/30 ./2');
const DRONE_THUMP = bbar('C2 ./15 C2 ./15 | C2 ./15 C2 ./15 | C2 ./15 C2 ./15 | C2 ./15 C2 ./15');
/** Faint digital crackle at fixed, uneven places. */
const DRONE_CRACKLE = bbar(
  './5 g:2 ./11 g:1 ./9 g:2 ./4 | ./12 g:1 ./3 g:2 ./15 | ./7 g:2 ./9 g:1 g:1 ./13 | ./20 g:2 ./5 g:1 ./5',
);

const FPS_BRIDGE: SongDef = {
  bpm: 60,
  rowsPerBeat: 8,
  // Mix level: the sting about as loud as `ams`, the drone a little under it.
  vol: 1.7,
  order: ['sting', 'drone'],
  loop: 1,
  channels: [
    { inst: ORGAN, vol: 1.5, pan: 0.05, patterns: { sting: STING_ORGAN } },
    { inst: TAPE, vol: 1.5, pan: 0.05, patterns: { sting: STING_TAPE } },
    { inst: PAH, vol: 1, pan: -0.2, patterns: { sting: STING_PAH } },
    { inst: DRONE, vol: 1, patterns: { drone: DRONE_PAD } },
    { inst: HUM, vol: 1, pan: 0.3, patterns: { drone: DRONE_HUM } },
    { inst: THUMP, vol: 1, patterns: { drone: DRONE_THUMP } },
    { inst: 'drums', vol: 0.6, kit: { ...KIT, g: 'fps/glitch' }, patterns: { sting: STING_GLITCH, drone: DRONE_CRACKLE } },
  ],
};

// ---------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------

/** Every song of this module by id (docs/design/fps.md §9.2; tests parse them). */
export const FPS_SONGS: Readonly<Record<string, SongDef>> = {
  'fps-floor': FPS_FLOOR,
  'fps-boss': FPS_BOSS,
  'fps-tally': FPS_TALLY,
  'fps-bridge': FPS_BRIDGE,
};

/** Rows per bar of each song (4/4 everywhere; the bridge runs 8 rows per beat). */
export const FPS_SONG_BAR: Readonly<Record<string, number>> = {
  'fps-floor': 16,
  'fps-boss': 16,
  'fps-tally': 16,
  'fps-bridge': BRIDGE_BAR,
};

/** Registers every fps song (called once by content/fps/sound.ts). */
export function registerFpsSongs(): void {
  for (const [id, song] of Object.entries(FPS_SONGS)) defineSong(id, song);
}
