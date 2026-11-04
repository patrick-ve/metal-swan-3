import { PixelBuffer } from './pixel';
import type { Frame } from './render';
import { defineSprite, hasHiSprite, hasSprite, listDenseAliases } from './sprites';

/**
 * Baked sets (docs/api/media.md "Baked sets", docs/design/ams40.md "Pipeline"): character art made
 * offline by `npm run art40 -- <slug>` (tools/art40/) and checked in as generated TypeScript
 * (`src/game/content/art40/<slug>.gen.ts`). One palette per set, indexed and run-length-coded
 * pixels, anchors, points, durations, loop flags and the named event constants the game reads.
 *
 * `defineBakedSet(SET)` registers `<prefix>/<strip>` (and the same strips under every variant
 * prefix) through defineSprite. Frames decode on first `getFrames`. Baked sets are 1× only: no
 * dense art is registered, so every art tier draws the 1× frames (plan rule 7).
 */

/**
 * The pixel stream alphabet (format v2): 91 printable ASCII characters, '#' (0x23) to '~' (0x7e)
 * without the backslash; a character's value is its position (0..90). A frame's `px` is pairs of
 * characters: (run length - 1, palette index), row-major, runs continue across rows. One character
 * per byte keeps the data byte-aligned, so gzip finds the repeats (base64 hid them: about 30 % more
 * after gzip); no character needs an escape in a JSON or TypeScript string.
 */
export const PX_ALPHABET = (() => {
  let s = '';
  for (let c = 0x23; c <= 0x7e; c++) if (c !== 0x5c) s += String.fromCharCode(c);
  return s;
})();
/** The longest run one pair holds (value 90 + 1). */
export const PX_MAX_RUN = PX_ALPHABET.length;
/** The most palette entries a set may have (index 0 transparent .. 90). */
export const PX_MAX_PALETTE = PX_ALPHABET.length;
/** The baked set format this engine reads. */
export const BAKED_FORMAT = 2;

/** One frame: `px` = the pixel stream (PX_ALPHABET pairs: run - 1, palette index), row-major. */
export interface BakedFrame {
  w: number;
  h: number;
  /** The anchor in the frame ('feet' = floor(w / 2), h unless the contract says otherwise). */
  ox: number;
  oy: number;
  px: string;
  /** Named points relative to the anchor of the unflipped frame (the engine convention). */
  pts?: Record<string, readonly [number, number]>;
  /** A smear frame (at most 2 per strip). */
  smear?: true;
}

export interface BakedStrip {
  frames: BakedFrame[];
  /** Hold of each frame in 60 Hz ticks. */
  durations: number[];
  loop: boolean;
  defer?: true;
  /** The plan's action class of the strip (tools/art40/classes.json). */
  cls?: string;
  /** The logged reason when the strip has fewer frames than its class count. */
  why?: string;
  /** The way this strip's unflipped frames face when it differs from the set's `face`. */
  face?: 1 | -1;
}

export interface BakedSet {
  v: 2;
  /** tools/art40/chars/<slug>/ */
  slug: string;
  /** Id prefix: strip 'walk' becomes id '<prefix>/walk'. */
  prefix: string;
  /** Colour budget of plan D1 (figures 28, machines and multi-part 40, the mayor 64). */
  budget: 28 | 40 | 64;
  /** The way the unflipped frames face (+1 right, -1 left): the direction a walk cycle moves. */
  face?: 1 | -1;
  /** '#rrggbb'; index 0 = transparent (never drawn). At most PX_MAX_PALETTE entries. */
  pal: string[];
  /** Index of the one warm near-black outline colour. */
  outline: number;
  /** Indices allowed as single pixels (eyes, highlights, glints). */
  hl?: number[];
  /** Indices of the shared FX ramp (tools/art40/README.md "FX ramp"): outside the colour budget. */
  fx?: number[];
  /** Another id prefix → a palette of the same length (skins, P2): same pixels, other colours. */
  variants?: Record<string, string[]>;
  strips: Record<string, BakedStrip>;
  /** Named frame or tick constants the game code reads (THROW_RELEASE, KICK_HIT, ...). */
  events?: Record<string, number>;
}

export interface BakedSetOpts {
  /**
   * Register only these: strip names ('walk') or full ids ('enemy/x/walk', also a variant's). An
   * id is skipped when neither its strip name nor the id itself is listed.
   */
  only?: readonly string[];
}

const PX_VALUE = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < PX_ALPHABET.length; i++) t[PX_ALPHABET.charCodeAt(i)] = i;
  return t;
})();

/** The values (0..90) of a pixel stream. Throws on a character outside PX_ALPHABET or an odd length. */
export function bakedStreamValues(s: string): Uint8Array {
  if (s.length % 2) throw new Error(`baked: pixel stream of odd length ${s.length}`);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const v = c < 128 ? PX_VALUE[c] : -1;
    if (v < 0) throw new Error(`baked: bad pixel stream character at ${i}`);
    out[i] = v;
  }
  return out;
}

/** Encode palette indices (row-major) as a pixel stream (the bake's encoder, for tests and tools). */
export function encodeBakedIndices(idx: ArrayLike<number>): string {
  let s = '';
  let i = 0;
  while (i < idx.length) {
    const v = idx[i];
    if (!(v >= 0 && v < PX_MAX_PALETTE)) throw new Error(`baked: palette index ${v} outside 0..${PX_MAX_PALETTE - 1}`);
    let run = 1;
    while (i + run < idx.length && idx[i + run] === v && run < PX_MAX_RUN) run++;
    s += PX_ALPHABET[run - 1] + PX_ALPHABET[v];
    i += run;
  }
  return s;
}

/** The palette as packed 0xRRGGBBAA colours (index 0 transparent). */
export function bakedPalette(pal: readonly string[]): Uint32Array {
  const out = new Uint32Array(pal.length);
  for (let i = 1; i < pal.length; i++) {
    const m = /^#([0-9a-fA-F]{6})$/.exec(pal[i]);
    if (!m) throw new Error(`baked: palette entry ${i} "${pal[i]}" is not #rrggbb`);
    out[i] = ((parseInt(m[1], 16) << 8) | 0xff) >>> 0;
  }
  return out;
}

/** Indices of one frame (w × h, row-major) from its run-length data. */
export function decodeBakedIndices(f: BakedFrame): Uint8Array {
  const bytes = bakedStreamValues(f.px);
  const n = f.w * f.h;
  const out = new Uint8Array(n);
  let o = 0;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const run = bytes[i] + 1;
    if (o + run > n) throw new Error(`baked: run-length data overflows a ${f.w}×${f.h} frame`);
    out.fill(bytes[i + 1], o, o + run);
    o += run;
  }
  if (o !== n) throw new Error(`baked: run-length data has ${o} pixels, the ${f.w}×${f.h} frame ${n}`);
  return out;
}

/** One frame in a palette (packed colours, see bakedPalette): the runs fill the buffer directly. */
export function decodeBakedFrame(f: BakedFrame, pal: Uint32Array): Frame {
  const s = f.px;
  const n = f.w * f.h;
  if (s.length % 2) throw new Error(`baked: pixel stream of odd length ${s.length}`);
  const data = new Uint32Array(n);
  let o = 0;
  for (let i = 0; i + 1 < s.length; i += 2) {
    const a = s.charCodeAt(i);
    const b = s.charCodeAt(i + 1);
    const run = (a < 128 ? PX_VALUE[a] : -1) + 1;
    const k = b < 128 ? PX_VALUE[b] : -1;
    if (run < 1 || k < 0) throw new Error(`baked: bad pixel stream character at ${run < 1 ? i : i + 1}`);
    if (o + run > n) throw new Error(`baked: run-length data overflows a ${f.w}×${f.h} frame`);
    if (k >= pal.length) throw new Error(`baked: palette index ${k} outside a palette of ${pal.length}`);
    if (k !== 0) {
      const c = pal[k];
      if (run > 16) data.fill(c, o, o + run);
      else for (let j = o, e = o + run; j < e; j++) data[j] = c;
    }
    o += run;
  }
  if (o !== n) throw new Error(`baked: run-length data has ${o} pixels, the ${f.w}×${f.h} frame ${n}`);
  const frame: { buf: PixelBuffer; ox: number; oy: number; pts?: Frame['pts'] } = { buf: new PixelBuffer(f.w, f.h, data), ox: f.ox, oy: f.oy };
  if (f.pts) frame.pts = f.pts;
  return frame;
}

/** The ids a set registers (base prefix first, then each variant prefix; strips in set order). */
export function bakedSetIds(set: BakedSet, opts: BakedSetOpts = {}): string[] {
  const only = opts.only ? new Set(opts.only) : null;
  const out: string[] = [];
  for (const prefix of [set.prefix, ...Object.keys(set.variants ?? {})]) {
    for (const name of Object.keys(set.strips)) {
      const id = `${prefix}/${name}`;
      if (!only || only.has(name) || only.has(id)) out.push(id);
    }
  }
  return out;
}

/** Throws when the set breaks the format (checked at registration, before any id is added). */
function validate(set: BakedSet): void {
  const where = `baked set "${set.slug}"`;
  if (set.v !== BAKED_FORMAT) throw new Error(`${where}: format v${String(set.v)}, this engine reads v${BAKED_FORMAT} (bake again: npm run art40 -- ${set.slug})`);
  if (set.pal.length < 2 || set.pal.length > PX_MAX_PALETTE) throw new Error(`${where}: ${set.pal.length} palette entries (2..${PX_MAX_PALETTE})`);
  if (set.outline < 1 || set.outline >= set.pal.length) throw new Error(`${where}: outline index ${set.outline} outside the palette`);
  for (const [p, pal] of Object.entries(set.variants ?? {})) {
    if (p === set.prefix) throw new Error(`${where}: variant "${p}" is the set's own prefix`);
    if (pal.length !== set.pal.length) throw new Error(`${where}: variant "${p}" has ${pal.length} colours, the palette ${set.pal.length}`);
  }
  for (const [name, st] of Object.entries(set.strips)) {
    if (st.frames.length === 0) throw new Error(`${where}: strip "${name}" has no frames`);
    if (st.durations.length !== st.frames.length) {
      throw new Error(`${where}: strip "${name}" has ${st.durations.length} durations for ${st.frames.length} frames`);
    }
    if (st.durations.some((d) => !(d >= 1))) throw new Error(`${where}: strip "${name}" has a duration below 1 tick`);
  }
}

/**
 * Register a baked set: '<prefix>/<strip>' and every variant prefix's ids through defineSprite
 * (durations, loop, defer). Frames decode on first getFrames of their id (the registry caches
 * them; a variant decodes the same run-length data through its own palette, nothing else is kept). No dense art is registered: getFrames
 * at d 2 or 4 returns the 1× frames. Throws, registering nothing, when an id is already registered
 * (also only as dense art or as a dense alias): replacing an id means deleting its old registration
 * first (plan rule 8).
 * Returns the ids registered.
 */
export function defineBakedSet(set: BakedSet, opts: BakedSetOpts = {}): string[] {
  validate(set);
  const ids = bakedSetIds(set, opts);
  // Taken: a 1x sprite, dense art, or a dense alias (also one whose target has no dense art yet:
  // it would show the target's dense frames once they exist, plan rule 7).
  const aliases = new Set([...listDenseAliases(2), ...listDenseAliases(4)].map(([a]) => a));
  const taken = ids.filter((id) => hasSprite(id) || hasHiSprite(id, 2) || hasHiSprite(id, 4) || aliases.has(id));
  if (taken.length > 0) {
    const more = taken.length > 3 ? ` and ${taken.length - 3} more` : '';
    throw new Error(
      `defineBakedSet("${set.slug}"): ${taken.slice(0, 3).join(', ')}${more} already registered — delete the old registration first (docs/design/ams40.md rule 8)`,
    );
  }
  const palettes = new Map<string, string[]>([[set.prefix, set.pal], ...Object.entries(set.variants ?? {})]);
  const packed = new Map<string, Uint32Array>();
  const only = new Set(ids);
  for (const [prefix, pal] of palettes) {
    for (const [name, st] of Object.entries(set.strips)) {
      const id = `${prefix}/${name}`;
      if (!only.has(id)) continue;
      const gen = (): Frame[] => {
        let p = packed.get(prefix);
        if (!p) {
          p = bakedPalette(pal);
          packed.set(prefix, p);
        }
        const colours = p;
        return st.frames.map((f) => decodeBakedFrame(f, colours));
      };
      defineSprite(id, gen, { durations: st.durations, loop: st.loop, ...(st.defer ? { defer: true } : {}) });
    }
  }
  return ids;
}
