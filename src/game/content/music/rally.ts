/**
 * FILE FM's synth songs and jingles (mission rally, BINNEN DE RING; docs/design/rally.md §8;
 * docs/api/rally.md "C.R The radio"): the fallbacks of the three lap songs and the three jingles of
 * content/rally/radio/lines.ts. The radio (src/game/rally/radio.ts) plays a song ONCE to its end
 * (`MusicOpts.once`), then a jingle, then the lap's song again; AUDIO-GEN's ElevenLabs takes (group
 * 'mission:rally', the songs streamed) replace them when loaded. With no samples shipped the radio
 * still plays these. Owner: RADIO (wave C). Registers at import time; it imports only the engine and
 * the lines table (not ./index, which imports it).
 *
 * Every note was written for METAL SWAN 3 (docs/ORIGINALITY.md): no melody, bass line or arrangement
 * is taken from an existing tune; the genres are only genres (no artist, song, station or game).
 *
 * - `rally-lap1` RONDJE RING — lap 1, the low afternoon sun: an upbeat late-1990s Dutch dance-pop
 *   drive with bright synth stabs. A minor, 140 bpm, 88 bars (150.9 s): an octave-bouncing bass, a
 *   four-on-the-floor kit, off-beat saw stabs, a plucked 8th riff and a hook on a bright saw lead
 *   (F–G–Em–Am), a break on pads, an arpeggio and a bell, a snare build back into the hook.
 * - `rally-lap2` ZON OP DE ZUIDAS — lap 2, the sunset: euphoric trance-pop with warm pads. D minor,
 *   138 bpm, 88 bars (153.0 s): a rolling bass, a plucked 16th arpeggio, wide pads, a breakdown with
 *   the anthem on a soft lead, a riser, then the anthem (Dm–B♭–F–C) on a soaring lead.
 * - `rally-lap3` NACHTSPITS — lap 3, rush hour in the dark: a dark night-drive synth groove with a
 *   pulsing bass. E minor, 128 bpm, 80 bars (150.0 s): 8th-note pulse bass, gated pads, a slow
 *   melancholy lead (Em–C–Am–B), a break on an arpeggio, tom fills.
 * - `rally-jingle-1` 'FILE FM!' (4 s): four "sung" notes (FI-LE EF-EM) on a vowel lead, a brass hit.
 * - `rally-jingle-2` 'WIJ STAAN ER ALTIJD' (5 s): a synth sweep up, then the five "sung" syllables.
 * - `rally-jingle-3` the sting (3 s, instrumental; the lap change, the DJ talks over it).
 *
 * The songs loop to their top (`loop: 0`), so a plain `music(id)` loops them cleanly; the jingles
 * play once (`loop: null`).
 */
import { defineSong } from '../../../engine/audio';
import { noteToMidi, patternRows, type InstrumentDef, type SongDef } from '../../../engine/music';
import { defineSfx } from '../../../engine/synth';
import { RADIO_JINGLES, RADIO_SONGS } from '../rally/radio/lines';

// ---------------------------------------------------------------------------------------------
// Pattern helpers (every bar is checked for 16 rows)
// ---------------------------------------------------------------------------------------------

const BAR = 16;
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Melody shorthand → pattern rows (`X/n` held n rows, `X_n` 1 row + n−1 rests, `./n` rests, `-/n` holds). */
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
    if (!(n >= 1)) throw new Error(`music/rally: bad length in "${tok}"`);
    const fill = m[1] === '.' || m[2] === '_' ? '.' : '-';
    out.push(m[1]);
    for (let i = 1; i < n; i++) out.push(fill);
  }
  return out.join(' ');
}

/** Bars in shorthand separated by '|', each checked for exactly 16 rows. */
function bars(s: string | readonly string[]): string {
  const list = (typeof s === 'string' ? s.split('|') : s)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map(mel);
  list.forEach((b, i) => {
    const n = patternRows(b).length;
    if (n !== BAR) throw new Error(`music/rally: bar ${i} has ${n} rows, expected ${BAR}: "${b}"`);
  });
  return list.join(' | ');
}

/** A note moved by `semis` semitones ('A1', 12 → 'A2'). */
function up(note: string, semis: number): string {
  const m = noteToMidi(note);
  if (m === null) throw new Error(`music/rally: "${note}" is not a note`);
  const r = m + semis;
  return `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}

/** One bar of 16 rows from a row → token map (else rests). */
function row16(hits: Readonly<Record<number, string>>): string {
  const out: string[] = [];
  for (let i = 0; i < BAR; i++) out.push(hits[i] ?? '.');
  return out.join(' ');
}

/** The same item n times. */
function times<T>(x: T, n: number): T[] {
  return Array.from({ length: n }, () => x);
}

/** A chord: the bass root (octave 2 or 1) and a close voicing around the middle (3 notes). */
interface Chord {
  readonly root: string;
  readonly tones: readonly [string, string, string];
}

function chord(root: string, a: string, b: string, c: string): Chord {
  return { root, tones: [a, b, c] };
}

const voicing = (c: Chord, shift = 0): string => c.tones.map((n) => up(n, shift)).join('+');

// ---- Rhythm makers: one bar from one chord ----------------------------------------------------

/** The 1990s octave bass: 8ths that bounce between the root and its octave (short notes). */
function bassOctave(c: Chord): string {
  const r = c.root;
  const o = up(r, 12);
  return mel(`${r}_2 ${o}_2 ${r}_2 ${o}_2 ${r}_2 ${o}_2 ${r}_2 ${o}:6_2`);
}

/** The trance roll: three 16ths after every kick (the kick's own row is free). */
function bassRoll(c: Chord): string {
  const r = c.root;
  return row16({ 1: r, 2: `${r}:6`, 3: `${r}:7`, 5: r, 6: `${r}:6`, 7: `${r}:7`, 9: r, 10: `${r}:6`, 11: `${r}:7`, 13: r, 14: `${r}:6`, 15: `${up(r, 12)}:7` });
}

/** The night pulse: steady 8ths on the root, the beat a little stronger. */
function bassPulse(c: Chord): string {
  const r = c.root;
  return row16({ 0: `${r}!`, 2: `${r}:6`, 4: `${r}:8`, 6: `${r}:6`, 8: `${r}!`, 10: `${r}:6`, 12: `${r}:8`, 14: `${up(r, 12)}:6` });
}

/** Off-beat chord stabs (the "and" of every beat, one pushed). */
function stabs(c: Chord): string {
  const v = voicing(c);
  return row16({ 2: v, 6: v, 10: v, 13: `${v.split('+').map((n) => `${n}:6`).join('+')}` });
}

/** A held chord for the whole bar (a pad); `same` holds on from the bar before. */
function held(c: Chord, same: boolean, shift = 0): string {
  return same ? mel('-/16') : mel(`${voicing(c, shift)}/16`);
}

/** Held pads over a run of chords (a chord that repeats keeps sounding). */
function pads(list: readonly Chord[], shift = 0): string[] {
  return list.map((c, i) => held(c, i > 0 && list[i - 1] === c, shift));
}

/** A 16th arpeggio through the chord (indices into root-3rd-5th-octave-…, one octave up from the voicing's base). */
function arp(c: Chord, shape: readonly number[], shift = 0): string {
  const t = c.tones;
  const pool = [t[0], t[1], t[2], up(t[0], 12), up(t[1], 12), up(t[2], 12)];
  const out: string[] = [];
  for (let i = 0; i < BAR; i++) out.push(up(pool[shape[i % shape.length]], shift) + (i % 4 === 0 ? '' : ':6'));
  return out.join(' ');
}

/** Bars for a list of chords with a maker. */
const each = (list: readonly Chord[], f: (c: Chord) => string): string[] => list.map(f);

// ---------------------------------------------------------------------------------------------
// Drums (the default kit k s h o c t p r; x = the riser, b = the boom of the jingles)
// ---------------------------------------------------------------------------------------------

/** A noise sweep up (one bar at 140 bpm): the build into a hook. */
defineSfx('drum/rally-rise', {
  vol: 0.5,
  layers: [{ wave: 'noise', env: { a: 1.4, d: 0.25 }, vol: 0.8, filter: { type: 'bandpass', freq: 500, to: 7000, time: 1.6, q: 2 } }],
});

/** A deep boom under a jingle's hit. */
defineSfx('drum/rally-boom', {
  vol: 0.8,
  layers: [
    { wave: 'sine', freq: 90, to: 38, sweep: 0.35, env: { a: 0.002, d: 0.6 }, vol: 1 },
    { wave: 'noise', env: { a: 0.002, d: 0.12 }, vol: 0.3, filter: { type: 'lowpass', freq: 900 } },
  ],
});

const KIT: Readonly<Record<string, string>> = { x: 'drum/rally-rise', b: 'drum/rally-boom' };

/** Four on the floor: kicks, open hats on the off-beats, a clap on 2 and 4, soft 16th hats. */
const D_FOUR = 'k h:3 o h:3 K+p h:3 o h:3 k h:3 o h:3 K+p h:3 o h:4';
/** The same with a fill into the next bar (snare 16ths in the last beat). */
const D_FOUR_FILL = 'k h:3 o h:3 K+p h:3 o h:3 k h:3 o h:3 K+p s:5 s:6 s:8';
/** Only the kick and the hats (an intro). */
const D_KICK = 'k . h . k . h . k . h . k . h .';
/** A snare build (16ths that rise) over the last beats, then a crash on the next downbeat (the next pattern). */
const D_BUILD = ['s:3 . s:3 . s:4 . s:4 . s:5 . s:5 . s:6 . s:6 .', 's:5 s:5 s:6 s:6 s:6 s:7 s:7 s:7 s:8 s:8 s:8 s:9 S S S S'];
/** Half-time night kit: kick on 1 and the "and" of 2, snare on 2 and 4, 8th hats. */
const D_NIGHT = 'k . h . S+p . h k . . h . S+p . h .';
const D_NIGHT_FILL = 'k . h . S+p . h k . . t:6 . t:8 t:7 T t:9';
const D_HATS = 'h:5 . h . h:5 . h . h:5 . h . h:5 . h .';

/** A crash on the first beat of a bar, then the given bar. */
const crash = (bar: string): string => bar.replace(/^(\S+)/, (m) => (m === '.' ? 'c' : `c+${m}`));

// ---------------------------------------------------------------------------------------------
// rally-lap1 — RONDJE RING (A minor, 140 bpm)
// ---------------------------------------------------------------------------------------------

const L1 = {
  Am: chord('A2', 'A4', 'C5', 'E5'),
  F: chord('F2', 'A4', 'C5', 'F5'),
  C: chord('C3', 'G4', 'C5', 'E5'),
  G: chord('G2', 'G4', 'B4', 'D5'),
  Em: chord('E2', 'G4', 'B4', 'E5'),
};
const L1_V = [L1.Am, L1.F, L1.C, L1.G];
const L1_H = [L1.F, L1.G, L1.Em, L1.Am];

const L1_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.11, s: 0.35, r: 0.04 }, vol: 0.27, filter: { type: 'lowpass', freq: 620, q: 3.2, env: 3 } };
const L1_STAB: InstrumentDef = { kind: 'saw', detune: 12, env: { a: 0.002, d: 0.16, s: 0.12, r: 0.06 }, vol: 0.12, filter: { type: 'lowpass', freq: 2600, q: 1.4, env: 2.6 } };
const L1_RIFF: InstrumentDef = { kind: 'pulse', duty: 0.25, env: { a: 0.002, d: 0.09, s: 0.3, r: 0.04 }, vol: 0.12, filter: { type: 'lowpass', freq: 3600, q: 0.8 } };
const L1_LEAD: InstrumentDef = {
  kind: 'saw',
  detune: 9,
  env: { a: 0.006, d: 0.2, s: 0.75, r: 0.12 },
  vol: 0.2,
  vibrato: { rate: 5.6, depth: 14, delay: 0.25 },
  filter: { type: 'lowpass', freq: 3800, q: 1.2, env: 1.4 },
};
const L1_PAD: InstrumentDef = { kind: 'pad', env: { a: 0.25, d: 0.5, s: 0.75, r: 0.6 }, vol: 0.1, detune: 16, filter: { type: 'lowpass', freq: 2100, q: 0.7 } };
const L1_BELL: InstrumentDef = { kind: 'fm', env: { a: 0.002, d: 1.1, s: 0, r: 0.3 }, vol: 0.16, fm: { ratio: 3.5, index: 3.4, decay: 0.4 }, oneShot: true };

/** The plucked riff of the verse (8ths through each chord). */
const L1_RIFF_V = bars('A4_2 E5_2 A5_2 E5_2 C5_2 E5_2 A4_2 E5_2 | F4_2 C5_2 F5_2 C5_2 A4_2 C5_2 F4_2 C5_2 | G4_2 C5_2 E5_2 C5_2 G4_2 C5_2 E5_2 G5_2 | G4_2 D5_2 G5_2 D5_2 B4_2 D5_2 G5_2 B5_2');
/** The hook (F–G–Em–Am twice; the answer climbs). */
const L1_HOOK_1 = bars('A5_2 A5_2 C6_2 A5_2 G5/4 F5/4 | G5_2 G5_2 B5_2 G5_2 D6/6 B5/2 | E6_2 D6_2 B5_2 G5_2 E5/4 G5/4 | A5/12 ./4');
const L1_HOOK_2 = bars('A5_2 A5_2 C6_2 A5_2 G5/4 F5/4 | G5_2 G5_2 B5_2 D6_2 G6/4 F6/2 E6/2 | E6/4 D6/4 B5/4 G5/4 | A5/8 C6_2 B5_2 A5/4');

const RONDJE: SongDef = {
  bpm: 140,
  vol: 1.25,
  order: ['I1', 'I2', 'V', 'V', 'H1', 'H2', 'V', 'V', 'H1', 'H2', 'B', 'B', 'U', 'H1', 'H2', 'H1', 'H2', 'V', 'V', 'H1', 'H2', 'O'],
  loop: 0,
  channels: [
    {
      inst: 'drums',
      vol: 0.8,
      kit: KIT,
      patterns: {
        I1: bars([crash(D_KICK), D_KICK, D_KICK, D_FOUR_FILL.replace(/K\+p/g, 'k')]),
        I2: bars([crash(D_FOUR), D_FOUR, D_FOUR, D_FOUR_FILL]),
        V: bars([D_FOUR, D_FOUR, D_FOUR, D_FOUR_FILL]),
        H1: bars([crash(D_FOUR), D_FOUR, D_FOUR, D_FOUR]),
        H2: bars([D_FOUR, D_FOUR, D_FOUR, D_FOUR_FILL]),
        B: bars([crash(D_HATS), D_HATS, D_HATS, D_HATS]),
        U: bars([D_KICK, D_KICK, D_BUILD[0], `${D_BUILD[1].replace(/^s:5/, 's:5+x')}`]),
        O: bars([crash(D_FOUR), D_FOUR, D_KICK, 'k . . . k . . . k . . . c . . .']),
      },
    },
    {
      inst: L1_BASS,
      vol: 0.9,
      patterns: {
        I1: bars(each(L1_V, bassOctave)),
        I2: bars(each(L1_V, bassOctave)),
        V: bars(each(L1_V, bassOctave)),
        H1: bars(each(L1_H, bassOctave)),
        H2: bars(each(L1_H, bassOctave)),
        U: bars(each(L1_H, bassOctave)),
        O: bars([...each(L1_V.slice(0, 3), bassOctave), mel('A1/4 ./12')]),
      },
    },
    { inst: L1_RIFF, vol: 0.85, pan: -0.25, patterns: { I2: L1_RIFF_V, V: L1_RIFF_V, U: L1_RIFF_V, O: L1_RIFF_V } },
    { inst: L1_STAB, vol: 0.85, pan: 0.2, patterns: { V: bars(each(L1_V, stabs)), H1: bars(each(L1_H, stabs)), H2: bars(each(L1_H, stabs)) } },
    { inst: L1_LEAD, vol: 0.9, patterns: { H1: L1_HOOK_1, H2: L1_HOOK_2 } },
    { inst: L1_PAD, vol: 0.85, patterns: { H1: bars(pads(L1_H)), H2: bars(pads(L1_H)), B: bars(pads(L1_H)), U: bars(pads(L1_H)) } },
    { inst: L1_BELL, vol: 0.8, pan: 0.3, patterns: { B: bars([L1_HOOK_1.split(' | ')[0], L1_HOOK_1.split(' | ')[1], L1_HOOK_1.split(' | ')[2], L1_HOOK_1.split(' | ')[3]].map((b) => b.replace(/([A-G][#b]?)(\d)/g, (_m, n: string, o: string) => `${n}${Number(o) + 1}`))) } },
    { inst: 'pulse50', vol: 0.5, pan: -0.3, patterns: { B: bars(each(L1_H, (c) => arp(c, [0, 1, 2, 3, 2, 1]))) } },
  ],
};

// ---------------------------------------------------------------------------------------------
// rally-lap2 — ZON OP DE ZUIDAS (D minor, 138 bpm)
// ---------------------------------------------------------------------------------------------

const L2 = {
  Dm: chord('D2', 'D4', 'F4', 'A4'),
  Bb: chord('Bb1', 'D4', 'F4', 'Bb4'),
  F: chord('F2', 'C4', 'F4', 'A4'),
  C: chord('C2', 'C4', 'E4', 'G4'),
  Gm: chord('G1', 'D4', 'G4', 'Bb4'),
};
const L2_A = [L2.Dm, L2.Bb, L2.F, L2.C];
const L2_D = [L2.Bb, L2.F, L2.C, L2.Dm];

const L2_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.08, s: 0.4, r: 0.03 }, vol: 0.24, filter: { type: 'lowpass', freq: 520, q: 2.4, env: 2.6 } };
const L2_PLUCK: InstrumentDef = { kind: 'saw', detune: 6, env: { a: 0.001, d: 0.12, s: 0.0, r: 0.08 }, vol: 0.12, filter: { type: 'lowpass', freq: 3000, q: 2, env: 2.2 } };
const L2_PAD: InstrumentDef = { kind: 'pad', env: { a: 0.6, d: 0.8, s: 0.85, r: 1.1 }, vol: 0.12, detune: 22, filter: { type: 'lowpass', freq: 2400, q: 0.6 } };
const L2_LEAD: InstrumentDef = {
  kind: 'saw',
  detune: 14,
  env: { a: 0.02, d: 0.3, s: 0.8, r: 0.35 },
  vol: 0.19,
  vibrato: { rate: 5.2, depth: 16, delay: 0.3 },
  glide: 0.04,
  filter: { type: 'lowpass', freq: 4200, q: 1, env: 1.2 },
};
const L2_SOFT: InstrumentDef = { kind: 'sine', env: { a: 0.05, d: 0.3, s: 0.8, r: 0.5 }, vol: 0.2, vibrato: { rate: 5, depth: 12, delay: 0.3 } };

/** The anthem (Dm–B♭–F–C, then its answer). */
const L2_ANTHEM_1 = bars('D5/6 E5/2 F5/4 A5/4 | Bb5/8 A5/4 F5/4 | C6/6 A5/2 F5/4 G5/4 | E5/12 ./4');
const L2_ANTHEM_2 = bars('D5/6 E5/2 F5/4 A5/4 | D6/8 C6/4 Bb5/4 | A5/4 C6/4 F6/4 E6/4 | C6/8 G5/4 E5/4');
/** The breakdown's tune (over B♭–F–C–Dm): the anthem's shape, slow. */
const L2_DOWN = bars('D5/8 F5/8 | C5/8 A4/8 | E5/8 G5/8 | F5/12 E5/4');
const L2_ARP = [0, 2, 3, 2, 1, 3, 4, 3, 0, 2, 3, 5, 4, 3, 2, 1];

const ZUIDAS: SongDef = {
  bpm: 138,
  vol: 1.25,
  order: ['I', 'I', 'A', 'A', 'A', 'A', 'D', 'D', 'D', 'R', 'X1', 'X2', 'X1', 'X2', 'A', 'A', 'X1', 'X2', 'X1', 'X2', 'O', 'O'],
  loop: 0,
  channels: [
    {
      inst: 'drums',
      vol: 0.78,
      kit: KIT,
      patterns: {
        I: bars([crash(D_KICK), D_KICK, D_KICK, D_KICK]),
        A: bars([crash(D_FOUR), D_FOUR, D_FOUR, D_FOUR_FILL]),
        D: bars([crash('. . . . . . . . . . . . . . . .'), '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . h:3 . h:4 . h:5 . h:6 .']),
        R: bars(['k . . . k . . . k . . . k . . .', 'k . s:4 . k . s:5 . k . s:5 . k . s:6 .', D_BUILD[0], D_BUILD[1].replace(/^s:5/, 's:5+x')]),
        X1: bars([crash(D_FOUR), D_FOUR, D_FOUR, D_FOUR]),
        X2: bars([D_FOUR, D_FOUR, D_FOUR, D_FOUR_FILL]),
        O: bars([crash(D_FOUR), D_FOUR, D_KICK, D_KICK]),
      },
    },
    {
      inst: L2_BASS,
      vol: 0.9,
      patterns: {
        I: bars(each(L2_A, bassRoll)),
        A: bars(each(L2_A, bassRoll)),
        R: bars([...times('. . . . . . . . . . . . . . . .', 2), ...each([L2.C, L2.C], bassRoll)]),
        X1: bars(each(L2_A, bassRoll)),
        X2: bars(each(L2_A, bassRoll)),
        O: bars([...each(L2_A.slice(0, 3), bassRoll), mel('D2/4 ./12')]),
      },
    },
    { inst: L2_PLUCK, vol: 0.8, pan: 0.25, patterns: { A: bars(each(L2_A, (c) => arp(c, L2_ARP, 12))), X1: bars(each(L2_A, (c) => arp(c, L2_ARP, 12))), X2: bars(each(L2_A, (c) => arp(c, L2_ARP, 12))), R: bars(each([L2.Bb, L2.F, L2.C, L2.C], (c) => arp(c, L2_ARP, 12))), O: bars(each(L2_A, (c) => arp(c, L2_ARP, 12))) } },
    { inst: L2_PAD, vol: 0.9, patterns: { A: bars(pads(L2_A)), D: bars(pads(L2_D)), R: bars(pads([L2.Bb, L2.F, L2.C, L2.C])), X1: bars(pads(L2_A)), X2: bars(pads(L2_A)), O: bars(pads(L2_A)) } },
    { inst: L2_SOFT, vol: 0.8, pan: -0.2, patterns: { D: L2_DOWN } },
    { inst: L2_LEAD, vol: 0.9, patterns: { X1: L2_ANTHEM_1, X2: L2_ANTHEM_2 } },
  ],
};

// ---------------------------------------------------------------------------------------------
// rally-lap3 — NACHTSPITS (E minor, 128 bpm)
// ---------------------------------------------------------------------------------------------

const L3 = {
  Em: chord('E2', 'E4', 'G4', 'B4'),
  C: chord('C2', 'E4', 'G4', 'C5'),
  Am: chord('A1', 'E4', 'A4', 'C5'),
  B: chord('B1', 'D#4', 'F#4', 'B4'),
  D: chord('D2', 'D4', 'F#4', 'A4'),
};
const L3_A = [L3.Em, L3.C, L3.Am, L3.B];
const L3_C = [L3.C, L3.D, L3.Em, L3.Em];

const L3_BASS: InstrumentDef = { kind: 'saw', env: { a: 0.002, d: 0.14, s: 0.45, r: 0.05 }, vol: 0.26, detune: 5, filter: { type: 'lowpass', freq: 460, q: 3.6, env: 2.4 } };
/** A gated pad: a fast attack and release on 8th chords (the pulse of the street lamps). */
const L3_GATE: InstrumentDef = { kind: 'pad', env: { a: 0.01, d: 0.12, s: 0.6, r: 0.06 }, vol: 0.09, detune: 14, filter: { type: 'lowpass', freq: 1500, q: 0.8 } };
const L3_PAD: InstrumentDef = { kind: 'pad', env: { a: 0.5, d: 0.6, s: 0.8, r: 0.9 }, vol: 0.1, detune: 18, filter: { type: 'lowpass', freq: 1300, q: 0.7 } };
const L3_LEAD: InstrumentDef = {
  kind: 'pulse',
  duty: 0.3,
  env: { a: 0.01, d: 0.25, s: 0.7, r: 0.25 },
  vol: 0.18,
  vibrato: { rate: 5, depth: 18, delay: 0.35 },
  glide: 0.05,
  filter: { type: 'lowpass', freq: 2600, q: 1.1 },
};
const L3_ARP: InstrumentDef = { kind: 'triangle', env: { a: 0.002, d: 0.1, s: 0.2, r: 0.06 }, vol: 0.2 };

/** The gated chords: 8ths with the "and" softer. */
function gated(c: Chord): string {
  const v = voicing(c);
  const s = c.tones.map((n) => `${n}:6`).join('+');
  return row16({ 0: v, 2: s, 4: v, 6: s, 8: v, 10: s, 12: v, 14: s });
}

const L3_LEAD_1 = bars('B4/6 E5/2 G5/4 F#5/4 | E5/8 D5/4 B4/4 | C5/6 B4/2 A4/4 E5/4 | D#5/12 ./4');
const L3_LEAD_2 = bars('B4/6 E5/2 G5/4 B5/4 | C6/8 B5/4 G5/4 | A5/6 G5/2 E5/4 C5/4 | B4/8 D#5/4 F#5/4');

const NACHTSPITS: SongDef = {
  bpm: 128,
  vol: 1.3,
  order: ['I', 'I', 'A', 'A', 'A', 'A', 'L1', 'L2', 'L1', 'L2', 'C', 'C', 'L1', 'L2', 'L1', 'L2', 'A2', 'A2', 'O', 'O'],
  loop: 0,
  channels: [
    {
      inst: 'drums',
      vol: 0.8,
      kit: KIT,
      patterns: {
        I: bars([crash(D_HATS), D_HATS, D_HATS, D_HATS]),
        A: bars([crash(D_NIGHT), D_NIGHT, D_NIGHT, D_NIGHT_FILL]),
        L1: bars([crash(D_NIGHT), D_NIGHT, D_NIGHT, D_NIGHT]),
        L2: bars([D_NIGHT, D_NIGHT, D_NIGHT, D_NIGHT_FILL]),
        C: bars([crash(D_HATS), D_HATS, D_HATS, 'h:5 . h . h:5 . h . t:6 . t:7 . T . T T']),
        A2: bars([crash(D_NIGHT), D_NIGHT, D_NIGHT, D_NIGHT_FILL]),
        O: bars([crash(D_NIGHT), D_NIGHT, D_HATS, 'k . . . . . . . c . . . . . . .']),
      },
    },
    {
      inst: L3_BASS,
      vol: 0.95,
      patterns: {
        I: bars(each(L3_A, bassPulse)),
        A: bars(each(L3_A, bassPulse)),
        L1: bars(each(L3_A, bassPulse)),
        L2: bars(each(L3_A, bassPulse)),
        C: bars(each(L3_C, bassPulse)),
        A2: bars(each(L3_A, bassPulse)),
        O: bars([...each(L3_A.slice(0, 3), bassPulse), mel('E2/4 ./12')]),
      },
    },
    { inst: L3_GATE, vol: 0.85, pan: 0.15, patterns: { A: bars(each(L3_A, gated)), L1: bars(each(L3_A, gated)), L2: bars(each(L3_A, gated)), A2: bars(each(L3_A, gated)), O: bars(each(L3_A, gated)) } },
    { inst: L3_PAD, vol: 0.85, patterns: { I: bars(pads(L3_A)), C: bars(pads(L3_C)) } },
    { inst: L3_LEAD, vol: 0.9, pan: -0.1, patterns: { L1: L3_LEAD_1, L2: L3_LEAD_2 } },
    { inst: L3_ARP, vol: 0.75, pan: -0.3, patterns: { C: bars(each(L3_C, (c) => arp(c, [0, 1, 2, 3, 4, 3, 2, 1], 12))), A2: bars(each(L3_A, (c) => arp(c, [0, 2, 3, 2], 12))) } },
  ],
};

// ---------------------------------------------------------------------------------------------
// The jingles (played once)
// ---------------------------------------------------------------------------------------------

/** The "voice" of the jingles: a vowel-like double saw through a band-pass, a quick vibrato. */
const VOX: InstrumentDef = {
  kind: 'pad',
  env: { a: 0.02, d: 0.15, s: 0.85, r: 0.18 },
  vol: 0.22,
  detune: 8,
  vibrato: { rate: 6, depth: 20, delay: 0.12 },
  filter: { type: 'bandpass', freq: 1100, q: 1.1 },
};
/** The brass hit: a bright, fast saw chord. */
const BRASS: InstrumentDef = { kind: 'saw', detune: 10, env: { a: 0.012, d: 0.3, s: 0.55, r: 0.25 }, vol: 0.16, filter: { type: 'lowpass', freq: 1800, q: 1.3, env: 2.4 } };
const SPARK: InstrumentDef = { kind: 'fm', env: { a: 0.001, d: 0.5, s: 0, r: 0.2 }, vol: 0.12, fm: { ratio: 4, index: 2.5, decay: 0.3 }, oneShot: true };

/** FILE FM! — FI-LE EF-EM on the vowel lead (G5 E5 C6 C6), the brass hit on the last syllable. */
const JINGLE_1: SongDef = {
  bpm: 140,
  order: ['A'],
  loop: null,
  channels: [
    { inst: VOX, vol: 0.9, patterns: { A: bars('G5/3 E5/3 C6/2 C6/8 | -/6 ./10') } },
    { inst: BRASS, vol: 0.9, patterns: { A: bars('./8 C4+E4+G4+C5/8 | -/6 ./10') } },
    { inst: 'bass', vol: 0.8, patterns: { A: bars('./8 C2/8 | -/6 ./10') } },
    { inst: SPARK, vol: 0.7, patterns: { A: bars('./8 C7_2 G6_2 E6_2 C6_2 | ./16') } },
    { inst: 'drums', vol: 0.85, kit: KIT, patterns: { A: bars(['k . . k . . k . c+b . . . . . . .', '. . . . . . . . . . . . . . . .']) } },
  ],
};

/** WIJ STAAN ER ALTIJD — a sweep up (an arpeggio over the riser), then wij STAAN er AL-tijd. */
const JINGLE_2: SongDef = {
  bpm: 140,
  order: ['A'],
  loop: null,
  channels: [
    { inst: 'pulse25', vol: 0.55, patterns: { A: bars('A3_1 C#4_1 E4_1 A4_1 C#5_1 E5_1 A5_1 C#6_1 E6_1 A6_1 ./6 | ./16 | ./16') } },
    { inst: VOX, vol: 0.9, patterns: { A: bars('./16 | E5/2 A5/6 G5/2 C6/2 A5/4 | -/8 ./8') } },
    { inst: BRASS, vol: 0.8, patterns: { A: bars('./16 | ./12 F4+A4+C5/4 | -/8 ./8') } },
    { inst: 'pad', vol: 0.8, patterns: { A: bars('./16 | A3+C#4+E4/12 F3+A3+C4/4 | -/8 ./8') } },
    { inst: 'bass', vol: 0.75, patterns: { A: bars('./16 | A1/12 F1/4 | -/8 ./8') } },
    { inst: 'drums', vol: 0.8, kit: KIT, patterns: { A: bars(['x . . . . . . . . . . . . . . .', 'c+k . . . . . . . . . . . k . . .', 'c+b . . . . . . . . . . . . . . .']) } },
  ],
};

/** The sting: three brass chords (dum-da-DAAM), a boom and a sparkle (B♭ – C – D). */
const JINGLE_3: SongDef = {
  bpm: 150,
  order: ['A'],
  loop: null,
  channels: [
    { inst: BRASS, vol: 1, patterns: { A: bars('Bb3+D4+F4+Bb4_3 C4+E4+G4+C5_3 D4+F#4+A4+D5/10 | -/4 ./12') } },
    { inst: 'bass', vol: 0.8, patterns: { A: bars('Bb1_3 C2_3 D2/10 | -/4 ./12') } },
    { inst: SPARK, vol: 0.8, patterns: { A: bars('./6 D7_2 A6_2 F#6_2 D6_2 A5_2 | ./16') } },
    { inst: 'drums', vol: 0.85, kit: KIT, patterns: { A: bars(['k . . k . . c+b . . . . . . . . .', '. . . . . . . . . . . . . . . .']) } },
  ],
};

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const [LAP1, LAP2, LAP3] = RADIO_SONGS;
const [J1, J2, J3] = RADIO_JINGLES;

/** FILE FM's synth songs by id (the tests read them). */
export const RALLY_SONGS: Readonly<Record<string, SongDef>> = {
  [LAP1.id]: RONDJE,
  [LAP2.id]: ZUIDAS,
  [LAP3.id]: NACHTSPITS,
  [J1.id]: JINGLE_1,
  [J2.id]: JINGLE_2,
  [J3.id]: JINGLE_3,
};

/** PREP's name of the same table (wave C PREP's test reads it). */
export const RALLY_PLACEHOLDER_SONGS = RALLY_SONGS;

for (const [id, song] of Object.entries(RALLY_SONGS)) defineSong(id, song);
