/**
 * Tracker-style songs (docs/ARCHITECTURE.md §5.7, docs/api/media.md §9.2).
 *
 * A song is plain data: bpm, rows per beat, channels (instrument + named pattern strings), an
 * order list of pattern names and a loop point. `parseSong` validates it with clear error
 * messages and flattens it into note events; `songEvents` is the pure scheduler: given a time
 * window it returns the notes that start inside it, with loops unrolled. The Web Audio player
 * (audio.browser.ts) only turns those events into sound. Songs must be original compositions.
 *
 * Pattern tokens (whitespace separated, '|' bar lines are ignored):
 *   C4  F#3  Bb2       note (octave 0–8); suffix ! = accent, :1 … :9 = velocity 0.1–0.9
 *   ~E4                slide into E4 from the previous (still held) note
 *   C4+E4+G4           chord (several notes on one row)
 *   -                  hold: the previous note lasts one more row
 *   .                  empty row (the previous note is released)
 *   drum channels:     one letter per hit from the channel's kit (default: k kick, s snare,
 *                      h hat, o open hat, c crash, t tom, p clap, r rim); upper case = accent;
 *                      k+h = both on one row
 * Order entries may transpose melodic channels for that slot: 'A+2', 'B-12'.
 */
import { defineSfx } from './synth';
import type { SfxRecipe } from './synth';

/** A drum hit is any sound effect id (the default kit uses 'drum/<name>'). */
export type DrumId = string;

export interface InstrumentEnv {
  /** Attack, decay, release in seconds; sustain level 0..1. */
  a: number;
  d: number;
  s: number;
  r: number;
}

export interface InstrumentDef {
  kind: 'pulse' | 'triangle' | 'saw' | 'sine' | 'fm' | 'pad' | 'drums';
  /** Pulse duty (0.125, 0.25, 0.5). */
  duty?: number;
  env: InstrumentEnv;
  /** Instrument gain (default 0.3). */
  vol?: number;
  /** Detune spread in cents: two voices ±detune/2 (pad: three voices). */
  detune?: number;
  /** Vibrato: rate Hz, depth cents, delay s. */
  vibrato?: { rate: number; depth: number; delay: number };
  /** Tremolo: rate Hz, depth 0..1 (amplitude wobble). */
  tremolo?: { rate: number; depth: number };
  /** Filter; `env` > 1 opens the cutoff by that factor at the note start. */
  filter?: { type: 'lowpass' | 'highpass' | 'bandpass'; freq: number; q?: number; env?: number };
  /** FM bell: modulator ratio, modulation index, index decay time (s). */
  fm?: { ratio: number; index: number; decay: number };
  /** Transpose in octaves. */
  octave?: number;
  /** Ring through attack + decay regardless of the note length (bells, plucks). */
  oneShot?: boolean;
  /** Portamento in seconds between legato notes (also the time of `~` slides; default 0.06). */
  glide?: number;
}

export type InstrumentId =
  | 'pulse12'
  | 'pulse25'
  | 'pulse50'
  | 'square'
  | 'triangle'
  | 'bass'
  | 'saw'
  | 'lead'
  | 'sine'
  | 'bell'
  | 'pad'
  | 'drums';

/** Built-in instruments (level-balanced). Songs may also pass their own InstrumentDef. */
export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentDef>> = {
  pulse12: { kind: 'pulse', duty: 0.125, env: { a: 0.004, d: 0.12, s: 0.55, r: 0.06 }, vol: 0.45 },
  pulse25: { kind: 'pulse', duty: 0.25, env: { a: 0.004, d: 0.12, s: 0.6, r: 0.06 }, vol: 0.32 },
  pulse50: { kind: 'pulse', duty: 0.5, env: { a: 0.004, d: 0.1, s: 0.65, r: 0.06 }, vol: 0.19 },
  square: { kind: 'pulse', duty: 0.5, env: { a: 0.004, d: 0.1, s: 0.65, r: 0.06 }, vol: 0.19 },
  triangle: { kind: 'triangle', env: { a: 0.003, d: 0.06, s: 0.9, r: 0.05 }, vol: 0.38 },
  bass: { kind: 'triangle', env: { a: 0.003, d: 0.08, s: 0.85, r: 0.04 }, vol: 0.42 },
  saw: { kind: 'saw', env: { a: 0.008, d: 0.2, s: 0.7, r: 0.1 }, vol: 0.28, filter: { type: 'lowpass', freq: 2600, q: 1.2, env: 2 } },
  lead: {
    kind: 'saw',
    env: { a: 0.01, d: 0.25, s: 0.75, r: 0.12 },
    vol: 0.26,
    detune: 6,
    vibrato: { rate: 5.5, depth: 18, delay: 0.22 },
    filter: { type: 'lowpass', freq: 3200, q: 1.5, env: 1.8 },
  },
  sine: { kind: 'sine', env: { a: 0.01, d: 0.2, s: 0.7, r: 0.15 }, vol: 0.22 },
  bell: { kind: 'fm', env: { a: 0.002, d: 1.4, s: 0, r: 0.4 }, vol: 0.3, fm: { ratio: 3.5, index: 5, decay: 0.5 }, oneShot: true },
  pad: {
    kind: 'pad',
    env: { a: 0.35, d: 0.6, s: 0.7, r: 0.7 },
    vol: 0.14,
    detune: 14,
    filter: { type: 'lowpass', freq: 1500, q: 0.8 },
  },
  drums: { kind: 'drums', env: { a: 0, d: 0, s: 1, r: 0 }, vol: 0.8 },
};

/** Default drum kit: pattern letter → sfx id. */
export const DEFAULT_KIT: Readonly<Record<string, string>> = {
  k: 'drum/kick',
  s: 'drum/snare',
  h: 'drum/hat',
  o: 'drum/ohat',
  c: 'drum/crash',
  t: 'drum/tom',
  p: 'drum/clap',
  r: 'drum/rim',
};

export interface ChannelDef {
  /** Instrument preset id or a custom definition. */
  inst: InstrumentId | InstrumentDef;
  /** Channel gain 0..1 (default 1). */
  vol?: number;
  /** Stereo position -1..1 (default 0). */
  pan?: number;
  /** Pattern strings by pattern name; a missing name is silence for that slot. */
  patterns: Readonly<Record<string, string>>;
  /** Semitones added to every note. */
  transpose?: number;
  /** Drum channels: extra or replaced kit letters (lower case) → sfx id, e.g. { x: 'env/thunder' }. */
  kit?: Readonly<Record<string, string>>;
}

export interface SongDef {
  bpm: number;
  /** Rows per beat (default 4 = sixteenth notes; 6/8 at a dotted-quarter bpm: 6). */
  rowsPerBeat?: number;
  /** Delays every odd row by this fraction of a row (0..0.5) for a shuffle feel. */
  swing?: number;
  /** Song gain (default 1). */
  vol?: number;
  channels: readonly ChannelDef[];
  /** Pattern names in play order; 'A+2' / 'A-12' transposes melodic channels for that slot. */
  order: readonly string[];
  /** Order index to continue from after the last pattern; null = play once. Default 0. */
  loop?: number | null;
}

/** One note of the flattened song (rows are absolute within one pass of the order). */
export interface SongNote {
  row: number;
  ch: number;
  /** MIDI note number (melodic channels) or 0 for drums. */
  midi: number;
  /** Drum hit: the sfx id to play. */
  drum?: DrumId;
  /** Length in rows (1 + following holds). */
  rows: number;
  vel: number;
  /** Slide: start at this MIDI note and glide to `midi` over `glide` seconds. */
  from?: number;
  glide?: number;
}

export interface ParsedChannel {
  inst: InstrumentDef;
  vol: number;
  pan: number;
}

export interface ParsedSong {
  readonly bpm: number;
  readonly rowsPerBeat: number;
  /** Seconds per row. */
  readonly rowDur: number;
  readonly swing: number;
  readonly vol: number;
  readonly channels: readonly ParsedChannel[];
  /** Notes sorted by row. */
  readonly notes: readonly SongNote[];
  /** Rows in one pass of the order list. */
  readonly totalRows: number;
  /** First row of the looping part, or null for a one-shot song. */
  readonly loopRow: number | null;
  /** First row of each order-list slot (`orderRows[i]` = where `order[i]` starts). */
  readonly orderRows: readonly number[];
  /** Index into `notes` of the first note of each row (length totalRows + 1). */
  readonly rowStart: Int32Array;
}

export class SongError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SongError';
  }
}

const NOTE_BASE: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DEFAULT_GLIDE = 0.06;

/** 'C4' → 60, 'F#3' → 54, 'Bb2' → 46; null if not a note. */
export function noteToMidi(tok: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(\d)$/.exec(tok);
  if (!m) return null;
  const base = NOTE_BASE[m[1].toUpperCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Splits a pattern string into row tokens (bar lines removed). */
export function patternRows(pattern: string): string[] {
  return pattern.split(/\s+/).filter((t) => t.length > 0 && t !== '|');
}

interface TokNote {
  midi: number;
  drum?: DrumId;
  vel: number;
  slide: boolean;
}

interface ParsedTok {
  kind: 'rest' | 'hold' | 'notes';
  notes: TokNote[];
}

function parseToken(tok: string, kit: Readonly<Record<string, string>> | null, where: () => string): ParsedTok {
  if (tok === '.') return { kind: 'rest', notes: [] };
  if (tok === '-') return { kind: 'hold', notes: [] };
  const notes = tok.split('+').map((p): TokNote => {
    let vel = 0.8;
    let body = p;
    let slide = false;
    if (body.startsWith('~')) {
      slide = true;
      body = body.slice(1);
    }
    if (body.endsWith('!')) {
      vel = 1;
      body = body.slice(0, -1);
    } else {
      const v = /^(.*):([1-9])$/.exec(body);
      if (v) {
        vel = Number(v[2]) / 10;
        body = v[1];
      }
    }
    if (kit) {
      const sfx = body.length === 1 ? kit[body.toLowerCase()] : undefined;
      if (!sfx) {
        const letters = Object.keys(kit).sort().join(' ');
        throw new SongError(`${where()}: "${p}" is not a drum of this kit (letters: ${letters}; upper case = accent)`);
      }
      return { midi: 0, drum: sfx, vel: body === body.toUpperCase() ? Math.max(vel, 1) : vel, slide: false };
    }
    const midi = noteToMidi(body);
    if (midi === null) {
      throw new SongError(`${where()}: "${p}" is not a note (expected e.g. C4, F#3, Bb2, ~E4, '.', '-', 'C4+E4')`);
    }
    return { midi, vel, slide };
  });
  return { kind: 'notes', notes };
}

/** 'A' → ['A', 0]; 'A+2' → ['A', 2] unless a pattern is literally named 'A+2'. */
function slotOf(entry: string, known: ReadonlySet<string>): [string, number] {
  if (known.has(entry)) return [entry, 0];
  const m = /^(.+?)([+-]\d+)$/.exec(entry);
  return m && known.has(m[1]) ? [m[1], Number(m[2])] : [entry, 0];
}

/** Validate and flatten a song. Throws SongError with a clear message on bad input. */
export function parseSong(def: SongDef, id = 'song'): ParsedSong {
  function fail(msg: string): never {
    throw new SongError(`song "${id}": ${msg}`);
  }
  if (!def || typeof def !== 'object') fail('definition is missing');
  if (!(def.bpm > 0 && def.bpm < 1000)) fail(`bpm must be between 1 and 999 (got ${String(def.bpm)})`);
  const rowsPerBeat = def.rowsPerBeat ?? 4;
  if (!(Number.isInteger(rowsPerBeat) && rowsPerBeat > 0 && rowsPerBeat <= 16)) fail(`rowsPerBeat must be an integer 1..16 (got ${rowsPerBeat})`);
  if (!def.channels || def.channels.length === 0) fail('needs at least one channel');
  if (!def.order || def.order.length === 0) fail('order list is empty');
  const loop = def.loop === undefined ? 0 : def.loop;
  if (loop !== null && !(Number.isInteger(loop) && loop >= 0 && loop < def.order.length)) {
    fail(`loop must be an order index 0..${def.order.length - 1} or null (got ${String(loop)})`);
  }
  const swing = Math.max(0, Math.min(0.5, def.swing ?? 0));

  const channels: ParsedChannel[] = def.channels.map((c, ci) => {
    const inst = typeof c.inst === 'string' ? INSTRUMENTS[c.inst] : c.inst;
    if (!inst) fail(`channel ${ci}: unknown instrument "${String(c.inst)}" (use ${Object.keys(INSTRUMENTS).join(', ')})`);
    if (!c.patterns || typeof c.patterns !== 'object') fail(`channel ${ci}: patterns are missing`);
    return { inst, vol: Math.max(0, c.vol ?? 1), pan: Math.max(-1, Math.min(1, c.pan ?? 0)) };
  });
  const kits = def.channels.map((c, ci) => (channels[ci].inst.kind === 'drums' ? { ...DEFAULT_KIT, ...(c.kit ?? {}) } : null));
  const known = new Set<string>();
  for (const c of def.channels) for (const name of Object.keys(c.patterns)) known.add(name);

  // Every pattern used by the order must exist in at least one channel; per slot, all channels
  // that define it must agree on the row count.
  const slots = def.order.map((entry) => slotOf(entry, known));
  const slotRows: number[] = slots.map(([name], oi) => {
    let rows = -1;
    def.channels.forEach((c, ci) => {
      const p = c.patterns[name];
      if (p === undefined) return;
      const n = patternRows(p).length;
      if (n === 0) fail(`channel ${ci} pattern "${name}" is empty`);
      if (rows >= 0 && n !== rows) {
        fail(`pattern "${name}" has ${rows} rows in one channel but ${n} in channel ${ci} (all channels must match)`);
      }
      rows = n;
    });
    if (rows < 0) fail(`order[${oi}] uses pattern "${def.order[oi]}", which no channel defines`);
    return rows;
  });

  const notes: SongNote[] = [];
  let totalRows = 0;
  const loopRowAt: number[] = [];
  // Notes still sounding per channel (null after a rest): '-' extends them, slides start from them.
  const open: (SongNote[] | null)[] = def.channels.map(() => null);
  slots.forEach(([name, slotTranspose], oi) => {
    loopRowAt[oi] = totalRows;
    def.channels.forEach((c, ci) => {
      const p = c.patterns[name];
      const inst = channels[ci].inst;
      const kit = kits[ci];
      const transpose = (c.transpose ?? 0) + 12 * (inst.octave ?? 0) + slotTranspose;
      if (p === undefined) {
        open[ci] = null;
        return;
      }
      patternRows(p).forEach((tok, ri) => {
        const where = (): string => `song "${id}": channel ${ci} pattern "${name}" row ${ri}`;
        const t = parseToken(tok, kit, where);
        if (t.kind === 'hold') {
          const prev = open[ci];
          if (prev) for (const n of prev) n.rows++;
          return;
        }
        if (t.kind === 'rest') {
          open[ci] = null;
          return;
        }
        const row = totalRows + ri;
        const prev = open[ci];
        const made = t.notes.map((n) => {
          const midi = kit ? 0 : n.midi + transpose;
          if (!kit && (midi < 0 || midi > 127)) fail(`channel ${ci} pattern "${name}" row ${ri}: note out of range after transpose`);
          const note: SongNote = { row, ch: ci, midi, rows: 1, vel: n.vel };
          if (n.drum) note.drum = n.drum;
          // Slides: explicit '~', or automatic portamento between legato single notes.
          if (!kit && prev && prev.length === 1 && t.notes.length === 1 && (n.slide || (inst.glide ?? 0) > 0)) {
            note.from = prev[0].midi;
            note.glide = inst.glide ?? DEFAULT_GLIDE;
          }
          return note;
        });
        notes.push(...made);
        open[ci] = kit ? null : made;
      });
    });
    totalRows += slotRows[oi];
  });

  notes.sort((a, b) => a.row - b.row || a.ch - b.ch);
  const rowStart = new Int32Array(totalRows + 1);
  let k = 0;
  for (let r = 0; r <= totalRows; r++) {
    while (k < notes.length && notes[k].row < r) k++;
    rowStart[r] = k;
  }
  return {
    bpm: def.bpm,
    rowsPerBeat,
    rowDur: 60 / (def.bpm * rowsPerBeat),
    swing,
    vol: Math.max(0, def.vol ?? 1),
    channels,
    notes,
    totalRows,
    loopRow: loop === null ? null : loopRowAt[loop],
    rowStart,
    orderRows: loopRowAt,
  };
}

/** A note placed in time (seconds from the song start, loops unrolled). */
export interface ScheduledNote {
  time: number;
  /** Note length in seconds (before the instrument's release). */
  dur: number;
  ch: number;
  midi: number;
  drum?: DrumId;
  vel: number;
  /** Absolute row (keeps counting across loops). */
  row: number;
  /** Slide start note and glide time (seconds), when the note slides. */
  from?: number;
  glide?: number;
}

/** Start time in seconds of absolute row r (swing delays odd rows). */
export function rowTime(song: ParsedSong, r: number): number {
  return r * song.rowDur + (r % 2 === 1 ? song.swing * song.rowDur : 0);
}

/** Row of one pass that absolute row r plays, or -1 when a one-shot song has ended. */
export function localRow(song: ParsedSong, r: number): number {
  if (r < song.totalRows) return r;
  if (song.loopRow === null) return -1;
  const body = song.totalRows - song.loopRow;
  return song.loopRow + ((r - song.totalRows) % body);
}

/**
 * Song time (seconds) where order-list slot `index` starts (`MusicOpts.from`). The index is
 * clamped to the order list; fractions are floored. 0 for an empty or unknown slot.
 */
export function orderTime(song: ParsedSong, index: number): number {
  const rows = song.orderRows;
  if (!rows || rows.length === 0 || !Number.isFinite(index)) return 0;
  const i = Math.max(0, Math.min(rows.length - 1, Math.floor(index)));
  return rowTime(song, rows[i]);
}

/** Seconds of one pass through the order list. */
export function songLength(song: ParsedSong): number {
  return song.totalRows * song.rowDur;
}

/**
 * Pure scheduler: every note that starts in [t0, t1) (seconds from song start), in time order.
 * Results are appended to `out` (pass a reused array to avoid allocation).
 */
export function songEvents(song: ParsedSong, t0: number, t1: number, out: ScheduledNote[] = []): ScheduledNote[] {
  if (t1 <= t0 || song.totalRows === 0) return out;
  const first = Math.max(0, Math.floor(t0 / song.rowDur) - 1);
  const last = Math.ceil(t1 / song.rowDur) + 1;
  for (let r = first; r <= last; r++) {
    const t = rowTime(song, r);
    if (t < t0) continue;
    if (t >= t1) break;
    const lr = localRow(song, r);
    if (lr < 0) break;
    for (let i = song.rowStart[lr]; i < song.rowStart[lr + 1]; i++) {
      const n = song.notes[i];
      const ev: ScheduledNote = { time: t, dur: n.rows * song.rowDur, ch: n.ch, midi: n.midi, vel: n.vel, row: r };
      if (n.drum) ev.drum = n.drum;
      if (n.from !== undefined) {
        ev.from = n.from;
        ev.glide = n.glide;
      }
      out.push(ev);
    }
  }
  return out;
}

// ------------------------------------------------------------------ registry

const songs = new Map<string, { def: SongDef; parsed: ParsedSong | null; error: string | null }>();

/**
 * Register a song. Errors are reported (console.warn) and the song plays as silence, so a
 * typo never crashes the game; use parseSong in tests to see the message.
 */
export function defineSong(id: string, def: SongDef): void {
  try {
    songs.set(id, { def, parsed: parseSong(def, id), error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    songs.set(id, { def, parsed: null, error: msg });
    console.warn(`[music] ${msg}`);
  }
}

export function hasSong(id: string): boolean {
  return songs.has(id);
}

export function listSongs(prefix = ''): string[] {
  return [...songs.keys()].filter((id) => id.startsWith(prefix)).sort();
}

/** Parsed song, or null when unknown / invalid. */
export function getSong(id: string): ParsedSong | null {
  return songs.get(id)?.parsed ?? null;
}

export function songError(id: string): string | null {
  return songs.get(id)?.error ?? null;
}

// ------------------------------------------------------------------ drum kit (synth recipes)

/** Default kit sounds, registered as sfx 'drum/<name>' (redefine them to change the kit). */
export const DRUM_SFX: Readonly<Record<string, SfxRecipe>> = {
  kick: {
    vol: 0.7,
    layers: [
      { wave: 'sine', freq: 160, to: 42, sweep: 0.11, env: { a: 0.001, d: 0.32 }, vol: 1 },
      { wave: 'noise', env: { a: 0.0005, d: 0.012 }, vol: 0.35, filter: { type: 'highpass', freq: 2500 } },
    ],
  },
  snare: {
    vol: 0.7,
    layers: [
      { wave: 'noise', env: { a: 0.001, d: 0.19 }, vol: 0.75, filter: { type: 'bandpass', freq: 2200, q: 0.7 } },
      { wave: 'triangle', freq: 240, to: 160, sweep: 0.06, env: { a: 0.001, d: 0.09 }, vol: 0.7 },
    ],
  },
  hat: {
    vol: 0.45,
    layers: [{ wave: 'metal', freq: 30000, env: { a: 0.0005, d: 0.045 }, vol: 0.6, filter: { type: 'highpass', freq: 7000 } }],
  },
  ohat: {
    vol: 0.45,
    layers: [{ wave: 'metal', freq: 28000, env: { a: 0.001, d: 0.28 }, vol: 0.55, filter: { type: 'highpass', freq: 6500 } }],
  },
  crash: {
    vol: 0.5,
    layers: [
      { wave: 'noise', env: { a: 0.001, d: 1.3 }, vol: 0.5, filter: { type: 'highpass', freq: 4200 } },
      { wave: 'metal', freq: 22000, env: { a: 0.001, d: 0.9 }, vol: 0.3, filter: { type: 'highpass', freq: 5000 } },
    ],
  },
  tom: {
    vol: 0.85,
    layers: [{ wave: 'sine', freq: 190, to: 95, sweep: 0.2, env: { a: 0.001, d: 0.28 }, vol: 1 }],
  },
  clap: {
    vol: 0.7,
    layers: [0, 0.011, 0.022].map((delay) => ({
      wave: 'noise' as const,
      delay,
      env: { a: 0.0005, d: delay === 0.022 ? 0.16 : 0.012 },
      vol: 0.7,
      filter: { type: 'bandpass' as const, freq: 1300, q: 0.9 },
    })),
  },
  rim: {
    vol: 0.5,
    layers: [
      { wave: 'triangle', freq: 1700, env: { a: 0.0005, d: 0.03 }, vol: 0.8 },
      { wave: 'noise', env: { a: 0.0005, d: 0.015 }, vol: 0.5, filter: { type: 'bandpass', freq: 3200, q: 1.5 } },
    ],
  },
  // Extra hits (not in DEFAULT_KIT; map them with a channel `kit`, e.g. { b: 'drum/brush' }).
  /** Brush tap on a snare: a soft, short "tk". */
  brush: {
    vol: 0.6,
    layers: [
      { wave: 'noise', env: { a: 0.002, d: 0.07 }, vol: 0.8, filter: { type: 'bandpass', freq: 2600, q: 0.6 } },
      { wave: 'triangle', freq: 210, to: 170, env: { a: 0.001, d: 0.04 }, vol: 0.35 },
    ],
  },
  /** Brush sweep: a swelling "tshhh" (jazz brushes on 2 and 4). */
  swish: {
    vol: 0.55,
    layers: [{ wave: 'noise', env: { a: 0.05, d: 0.22 }, vol: 0.9, filter: { type: 'bandpass', freq: 4200, to: 2600, q: 0.7 } }],
  },
  /** Shaker: a dry grain of sand, made for running 16ths. */
  shaker: {
    vol: 0.5,
    layers: [{ wave: 'noise', env: { a: 0.008, d: 0.045 }, vol: 0.9, filter: { type: 'bandpass', freq: 6500, q: 1.1 } }],
  },
  /** Ride cymbal: a ping on top of a long, quiet wash. */
  ride: {
    vol: 0.42,
    layers: [
      { wave: 'metal', freq: 26000, env: { a: 0.001, d: 0.7 }, vol: 0.45, filter: { type: 'highpass', freq: 5200 } },
      { wave: 'sine', freq: 3150, env: { a: 0.001, d: 0.25 }, vol: 0.25 },
      { wave: 'noise', env: { a: 0.001, d: 0.02 }, vol: 0.3, filter: { type: 'highpass', freq: 7000 } },
    ],
  },
  /** Timpani-like boom near F2 (rolls: repeat it on 16ths with rising velocity). */
  timpani: {
    vol: 0.85,
    layers: [
      { wave: 'sine', freq: 96, to: 87, sweep: 0.12, env: { a: 0.003, d: 0.9 }, vol: 1 },
      { wave: 'triangle', freq: 175, env: { a: 0.002, d: 0.35 }, vol: 0.3 },
      { wave: 'noise', env: { a: 0.001, d: 0.04 }, vol: 0.25, filter: { type: 'lowpass', freq: 900 } },
    ],
  },
};

for (const [name, recipe] of Object.entries(DRUM_SFX)) defineSfx(`drum/${name}`, recipe);
