/**
 * The art40 gates over one baked set (plan docs/design/ams40.md "Gates", "Rules"). Pure: no file
 * access; tools/art40/check/index.ts loads the sets and the contract and prints the tables.
 *
 * Gates (a finding of level 'fail' fails the gate and the set):
 * - format: the set's shape (palette, indices, streams, durations, events, variants, smears).
 * - colour: colour budget (plan D1: 28 figures; 40 machines and multi-part, 64 the mayor, only
 *   for the slugs of rules.ts BUDGET_SLUGS): distinct colours without transparent and the shared
 *   FX ramp (`fx`, whose colours must come from rules.ts FX_RAMP), also per variant; unused
 *   palette entries and duplicates are warnings.
 * - outline: the one warm near-black outline colour (a cool one fails); its share of the outer
 *   edge pixels (opaque pixels with a transparent 4-neighbour or on the frame border) is >=
 *   OUTLINE_MIN_SHARE per set (the reference: about 2/3, the rest selout); a strip under
 *   OUTLINE_WARN_SHARE warns.
 * - orphan: no EDGE pixel (one with a transparent 4-neighbour) without an 8-neighbour of its own
 *   index, except indices in `hl` and `fx` (sparks and drops are single pixels). Single pixels
 *   inside the figure (all four 4-neighbours opaque) are material detail of the approved look
 *   (creases, buttons, rivets, stitches: 21 on the approved VINCENT sample, 37 on the handhaver)
 *   and are counted as info, for every budget (lead decision, wave 0 verify).
 * - aa: no anti-aliasing against transparency: no non-outline, non-fx pixel that touches
 *   transparency and whose opaque 4-neighbours are all outline (a halo pixel outside the outline).
 * - class: frame counts per action class (classes.ts); fewer frames need a `why`.
 * - contract: same ids, points, flags, logic time and events (contract.ts).
 * - foot: planted-foot drift <= 1 px per plant on locomotion strips against the contract speed,
 *   walking the way the frames face (`face` of the strip or set).
 * - smooth: no two identical consecutive frames; joint travel <= 3 px per displayed tick except
 *   out of smear frames (the measure of tests/art/motion.ts), over the set's joint track (the
 *   bake's sidecar: every rig joint), else over the baked points; a strip with neither is measured
 *   on its outline box (a warning only).
 */
import { actionClass } from './classes';
import { checkContract, type ContractEntry } from './contract';
import { decodeIndices, MAX_PALETTE } from './decode';
import { BUDGETS, BUDGET_SLUGS, budgetAllowed, FX_RAMP } from './rules';
import { GATES, type CheckFrame, type CheckSet, type CheckStrip, type Finding, type Gate, type GateState, type Level, type SetReport } from './types';

export const OUTLINE_MIN_SHARE = 0.5;
export const OUTLINE_WARN_SHARE = 0.4;
export const MAX_TRAVEL_PER_TICK = 3;
export const MAX_FOOT_DRIFT = 1;
/** A 'plant' point that moves forward (+x) by at least this much starts a new plant (the other foot). */
export const PLANT_SWITCH_PX = 2;
export const MAX_SMEARS = 2;
export { BUDGETS, BUDGET_SLUGS, FX_RAMP };
/** Point names that mark the planted foot (proposal to the bake: 'plant'; 'plantL' / 'plantR' also work). */
export const PLANT_POINTS: readonly string[] = ['plant', 'plantL', 'plantR'];

export interface CheckOpts {
  /** The contract entries by full id (contract.ts readContract); absent: the contract gate is skipped. */
  contract?: ReadonlyMap<string, ContractEntry>;
}

interface Decoded {
  strip: string;
  frame: number;
  f: CheckFrame;
  idx: Uint8Array | null;
}

function hexOk(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

function rgb(s: string): [number, number, number] {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance-ish brightness 0..255. */
function luma(s: string): number {
  const [r, g, b] = rgb(s);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

class Sink {
  readonly findings: Finding[] = [];
  add(gate: Gate, level: Level, msg: string, strip?: string, frame?: number): void {
    this.findings.push({ gate, level, msg, ...(strip !== undefined ? { strip } : {}), ...(frame !== undefined ? { frame } : {}) });
  }
}

function checkFormat(set: CheckSet, s: Sink): Decoded[] {
  if (set.v !== 2) s.add('format', 'fail', `v is ${String(set.v)}, want 2 (bake again)`);
  if (set.face !== undefined && set.face !== 1 && set.face !== -1) s.add('format', 'fail', `face ${String(set.face)} is not 1 or -1`);
  if (!set.slug || typeof set.slug !== 'string') s.add('format', 'fail', 'no slug');
  if (!set.prefix || set.prefix.endsWith('/')) s.add('format', 'fail', `bad prefix "${set.prefix}"`);
  if (set.prefix && set.slug && set.prefix.split('/').pop() !== set.slug) s.add('format', 'warn', `slug "${set.slug}" is not the last segment of prefix "${set.prefix}"`);
  const n = set.pal.length;
  if (n < 2) s.add('format', 'fail', 'palette has no colours');
  if (n > MAX_PALETTE) s.add('format', 'fail', `palette has ${n} entries (the pixel stream holds ${MAX_PALETTE})`);
  set.pal.forEach((c, i) => {
    if (i > 0 && !hexOk(c)) s.add('format', 'fail', `pal[${i}] "${c}" is not #rrggbb`);
  });
  if (!Number.isInteger(set.outline) || set.outline < 1 || set.outline >= n) s.add('format', 'fail', `outline index ${set.outline} is not a colour of the palette`);
  for (const h of set.hl ?? []) if (!Number.isInteger(h) || h < 1 || h >= n) s.add('format', 'fail', `hl index ${h} is not a colour of the palette`);
  for (const h of set.fx ?? []) if (!Number.isInteger(h) || h < 1 || h >= n || h === set.outline) s.add('format', 'fail', `fx index ${h} is not a non-outline colour of the palette`);
  for (const [vp, pal] of Object.entries(set.variants ?? {})) {
    if (vp === set.prefix) s.add('format', 'fail', `variant prefix "${vp}" is the set prefix`);
    if (pal.length !== n) s.add('format', 'fail', `variant "${vp}" has ${pal.length} entries, the palette ${n}`);
    pal.forEach((c, i) => {
      if (i > 0 && !hexOk(c)) s.add('format', 'fail', `variant "${vp}" [${i}] "${c}" is not #rrggbb`);
    });
  }
  const names = Object.keys(set.strips);
  if (names.length === 0) s.add('format', 'fail', 'no strips');
  const out: Decoded[] = [];
  for (const name of names) {
    const st = set.strips[name];
    if (!/^[a-z0-9][a-z0-9/_-]*$/.test(name)) s.add('format', 'fail', `strip name "${name}" is not a plain id segment`, name);
    if (st.frames.length === 0) s.add('format', 'fail', 'no frames', name);
    if (st.durations.length !== st.frames.length) s.add('format', 'fail', `${st.durations.length} durations for ${st.frames.length} frames`, name);
    st.durations.forEach((d, i) => {
      if (!Number.isInteger(d) || d < 1) s.add('format', 'fail', `duration ${d} is not a whole number of ticks >= 1`, name, i);
    });
    const smears = st.frames.filter((f) => f.smear).length;
    if (smears > MAX_SMEARS) s.add('format', 'fail', `${smears} smear frames (max ${MAX_SMEARS})`, name);
    st.frames.forEach((f, i) => {
      let idx: Uint8Array | null = null;
      if (!(Number.isInteger(f.w) && Number.isInteger(f.h) && f.w > 0 && f.h > 0)) s.add('format', 'fail', `size ${f.w}x${f.h}`, name, i);
      else if (!Number.isInteger(f.ox) || !Number.isInteger(f.oy)) s.add('format', 'fail', `anchor ${f.ox},${f.oy} is not whole`, name, i);
      else {
        try {
          idx = decodeIndices(f.px, f.w, f.h);
          let bad = -1;
          for (const v of idx) if (v >= n) bad = v;
          if (bad >= 0) {
            s.add('format', 'fail', `index ${bad} outside the palette (${n})`, name, i);
            idx = null;
          } else if (!idx.some((v) => v !== 0)) s.add('format', 'warn', 'empty frame', name, i);
        } catch (e) {
          s.add('format', 'fail', `pixel stream: ${(e as Error).message}`, name, i);
        }
      }
      for (const [k, p] of Object.entries(f.pts ?? {})) {
        if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => Number.isFinite(v))) s.add('format', 'fail', `point "${k}" is not [x, y]`, name, i);
      }
      out.push({ strip: name, frame: i, f, idx });
    });
  }
  for (const [k, v] of Object.entries(set.events ?? {})) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) s.add('format', 'fail', `event name "${k}" is not an UPPER_CASE constant`);
    if (!Number.isInteger(v) || v < 0) s.add('format', 'fail', `event ${k} = ${v} is not a whole number >= 0`);
  }
  return out;
}

function checkColour(set: CheckSet, frames: Decoded[], s: Sink): { colours: number; maxFrame: number } {
  if (!BUDGETS.includes(set.budget)) s.add('colour', 'fail', `budget ${set.budget} is not one of ${BUDGETS.join(' / ')}`);
  else if (!budgetAllowed(set.slug, set.budget)) s.add('colour', 'fail', `budget ${set.budget} is only for ${(BUDGET_SLUGS[set.budget] ?? []).join(', ')} (plan D1; tools/art40/check/rules.ts)`);
  // The budget counts distinct colours without transparent and without the shared FX ramp (fx).
  const fx = new Set(set.fx ?? []);
  const ramp = new Set(FX_RAMP);
  for (const [label, pal] of [['', set.pal] as const, ...Object.entries(set.variants ?? {}).map(([k, v]) => [`variant "${k}" `, v] as const)]) {
    for (const i of fx) {
      if (pal[i] === undefined) continue; // a short variant: the format gate says so
      const c = pal[i].toLowerCase();
      if (!ramp.has(c)) s.add('colour', 'fail', `${label}fx index ${i} is ${c}, not a colour of the shared FX ramp (rules.ts FX_RAMP)`);
    }
  }
  const distinct = (pal: readonly string[]): number => new Set(pal.filter((_, i) => i > 0 && !fx.has(i)).map((c) => c.toLowerCase())).size;
  const colours = distinct(set.pal);
  if (colours > set.budget) s.add('colour', 'fail', `${colours} palette colours > budget ${set.budget}${fx.size ? ` (${fx.size} fx not counted)` : ''}`);
  for (const [vp, pal] of Object.entries(set.variants ?? {})) {
    const n = distinct(pal);
    if (n > set.budget) s.add('colour', 'fail', `variant "${vp}": ${n} colours > budget ${set.budget}`);
  }
  const entries = set.pal.length - 1 - fx.size;
  if (colours < entries) s.add('colour', 'warn', `${entries - colours} duplicate palette entries`);
  const used = new Set<number>();
  let maxFrame = 0;
  for (const d of frames) {
    if (!d.idx) continue;
    const u = new Set<number>();
    for (const v of d.idx) if (v) u.add(v);
    for (const v of u) used.add(v);
    maxFrame = Math.max(maxFrame, u.size);
  }
  const unused: number[] = [];
  for (let i = 1; i < set.pal.length; i++) if (!used.has(i)) unused.push(i);
  if (unused.length) s.add('colour', 'warn', `palette indices never drawn: ${unused.join(', ')}`);
  return { colours, maxFrame };
}

interface EdgeStats {
  edge: number;
  outline: number;
  orphans: Array<[number, number]>;
  /** Single pixels inside the figure (material detail, allowed). */
  inner: number;
  halos: Array<[number, number]>;
}

function scanFrame(set: CheckSet, d: Decoded, hl: ReadonlySet<number>, fx: ReadonlySet<number>): EdgeStats {
  const { w, h } = d.f;
  const idx = d.idx as Uint8Array;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : idx[y * w + x]);
  const st: EdgeStats = { edge: 0, outline: 0, orphans: [], inner: 0, halos: [] };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = idx[y * w + x];
      if (!v) continue;
      const n4 = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      const isEdge = n4.some((q) => q === 0);
      if (isEdge) {
        st.edge++;
        if (v === set.outline) st.outline++;
        else {
          const opaque = n4.filter((q) => q !== 0);
          if (opaque.length > 0 && opaque.every((q) => q === set.outline) && !fx.has(v)) st.halos.push([x, y]);
        }
      }
      if (hl.has(v) || fx.has(v)) continue;
      let alone = true;
      for (let dy = -1; dy <= 1 && alone; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy) === v) alone = false;
      if (!alone) continue;
      if (isEdge) st.orphans.push([x, y]);
      else st.inner++;
    }
  }
  return st;
}

function checkPixels(set: CheckSet, frames: Decoded[], s: Sink): { share: number; minStrip: SetReport['minStripOutline']; orphans: number; halos: number } {
  const hl = new Set(set.hl ?? []);
  const fx = new Set(set.fx ?? []);
  const nearBlack = set.outline > 0 && set.outline < set.pal.length && hexOk(set.pal[set.outline]);
  if (nearBlack) {
    const c = set.pal[set.outline];
    const [r, , b] = rgb(c);
    if (luma(c) > 64) s.add('outline', 'fail', `outline ${c} is not a near-black (brightness ${luma(c).toFixed(0)} > 64)`);
    else if (r < b) s.add('outline', 'fail', `outline ${c} is cool (red < blue); the plan wants one warm near-black`);
  }
  let edge = 0;
  let outline = 0;
  let orphans = 0;
  let halos = 0;
  let inner = 0;
  const perStrip = new Map<string, { edge: number; outline: number }>();
  for (const d of frames) {
    if (!d.idx) continue;
    const st = scanFrame(set, d, hl, fx);
    inner += st.inner;
    edge += st.edge;
    outline += st.outline;
    const ps = perStrip.get(d.strip) ?? { edge: 0, outline: 0 };
    ps.edge += st.edge;
    ps.outline += st.outline;
    perStrip.set(d.strip, ps);
    if (st.orphans.length) {
      orphans += st.orphans.length;
      s.add('orphan', 'fail', `${st.orphans.length} orphan pixel(s) at ${fmtPts(st.orphans)}`, d.strip, d.frame);
    }
    if (st.halos.length) {
      halos += st.halos.length;
      s.add('aa', 'fail', `${st.halos.length} pixel(s) outside the outline (anti-aliasing against transparency) at ${fmtPts(st.halos)}`, d.strip, d.frame);
    }
  }
  if (inner) s.add('orphan', 'info', `${inner} single pixel(s) inside the figure (material detail, allowed)`);
  const share = edge ? outline / edge : 0;
  if (edge && share < OUTLINE_MIN_SHARE) s.add('outline', 'fail', `outline on ${(share * 100).toFixed(1)} % of the edge pixels (min ${OUTLINE_MIN_SHARE * 100} %)`);
  let minStrip: SetReport['minStripOutline'] = null;
  for (const [strip, ps] of perStrip) {
    if (!ps.edge) continue;
    const sh = ps.outline / ps.edge;
    if (!minStrip || sh < minStrip.share) minStrip = { strip, share: sh };
    if (sh < OUTLINE_WARN_SHARE) s.add('outline', 'warn', `outline on ${(sh * 100).toFixed(1)} % of the edge pixels`, strip);
  }
  return { share, minStrip, orphans, halos };
}

function fmtPts(p: Array<[number, number]>): string {
  const head = p.slice(0, 4).map(([x, y]) => `${x},${y}`).join(' ');
  return p.length > 4 ? `${head} …` : head;
}

function checkClasses(set: CheckSet, s: Sink): void {
  for (const [name, st] of Object.entries(set.strips)) {
    if (!st.cls) {
      s.add('class', 'fail', 'no action class (cls)', name);
      continue;
    }
    const c = actionClass(st.cls);
    if (!c) {
      s.add('class', 'fail', `unknown action class "${st.cls}" (tools/art40/check/classes.ts)`, name);
      continue;
    }
    const n = st.frames.length;
    if (c.why && !(st.why && st.why.trim())) s.add('class', 'fail', `class ${c.name} needs a logged reason (why)`, name);
    if (n < c.min) {
      if (st.why && st.why.trim()) s.add('class', 'info', `${n} frames < ${c.name} ${c.min}: ${st.why.trim()}`, name);
      else s.add('class', 'fail', `${n} frames < ${c.name} ${c.min} and no logged reason (why)`, name);
    } else if (c.max !== undefined && n > c.max) s.add('class', 'warn', `${n} frames > ${c.name} ${c.max}`, name);
  }
}

function sameFrame(a: CheckFrame, b: CheckFrame): boolean {
  return a.w === b.w && a.h === b.h && a.ox === b.ox && a.oy === b.oy && a.px === b.px;
}

/** The outline box of a frame relative to its anchor: [left, top, right, bottom] (fallback motion measure). */
function boxOf(f: CheckFrame): Record<string, readonly [number, number]> {
  return { 'box.tl': [-f.ox, -f.oy], 'box.br': [f.w - f.ox, f.h - f.oy] };
}

function checkSmooth(set: CheckSet, s: Sink): SetReport['worstTravel'] {
  let worst: SetReport['worstTravel'] = null;
  for (const [name, st] of Object.entries(set.strips)) {
    const n = st.frames.length;
    if (n < 2 || st.durations.length !== n) continue;
    const track = set.joints?.[name];
    const hasTrack = !!track && track.length === n;
    if (track && track.length !== n) s.add('smooth', 'fail', `joint track has ${track.length} frames, the strip ${n}`, name);
    const hasPts = st.frames.some((f) => Object.keys(f.pts ?? {}).some((k) => !PLANT_POINTS.includes(k)));
    const source = hasTrack ? 'joint' : hasPts ? 'point' : 'box';
    if (source === 'box') s.add('smooth', 'warn', 'no joint track and no points: motion measured on the outline box only (bake the rig joints: Frame(..., joints=...))', name);
    const ptsOf = (i: number): Readonly<Record<string, readonly [number, number]>> => (hasTrack ? (track as readonly Readonly<Record<string, readonly [number, number]>>[])[i] : hasPts ? (st.frames[i].pts ?? {}) : boxOf(st.frames[i]));
    const steps = st.loop ? n : n - 1;
    for (let i = 0; i < steps; i++) {
      const a = st.frames[i];
      const b = st.frames[(i + 1) % n];
      if (sameFrame(a, b)) s.add('smooth', 'fail', `frames ${i} and ${(i + 1) % n} are identical`, name, i);
      if (a.smear) continue;
      const dur = st.durations[i];
      const pa = ptsOf(i);
      const pb = ptsOf((i + 1) % n);
      for (const [k, p] of Object.entries(pa)) {
        const q = pb[k];
        if (!q || PLANT_POINTS.includes(k)) continue;
        const per = Math.hypot(q[0] - p[0], q[1] - p[1]) / dur;
        if (!worst || per > worst.perTick) worst = { strip: name, step: i, point: k, perTick: per };
        if (per > MAX_TRAVEL_PER_TICK) s.add('smooth', source === 'box' ? 'warn' : 'fail', `${source} "${k}" travels ${per.toFixed(2)} px/tick (max ${MAX_TRAVEL_PER_TICK}) from frame ${i}`, name, i);
      }
    }
  }
  return worst;
}

export interface PlantOpts {
  /** The direction the unflipped sprite walks: +1 right, -1 left. Default +1. */
  dir?: 1 | -1;
  /** Odometer strips: `speed` is px per FRAME (the code steps frames by distance), not per tick. */
  perFrame?: boolean;
}

/**
 * Planted-foot drift of one strip at `speed` px per tick (or per frame, `perFrame`). A plant is a
 * run of frames that carry the point; for 'plant' a jump >= PLANT_SWITCH_PX in the walking
 * direction starts a new run (the other foot). Drift of a run = (x_last - x_first) + dir × the
 * distance the body moved between them, and the y change. Loops wrap. One drift per run of >= 2
 * frames.
 */
export function plantDrifts(st: CheckStrip, speed: number, o: PlantOpts = {}): Array<{ point: string; from: number; drift: number }> {
  const n = st.frames.length;
  const dir = o.dir ?? 1;
  const out: Array<{ point: string; from: number; drift: number }> = [];
  for (const k of PLANT_POINTS) {
    const has = st.frames.map((f) => f.pts?.[k]);
    if (!has.some(Boolean)) continue;
    const breaks = (i: number): boolean => {
      // true when frame i does not continue the plant of frame i - 1
      const prev = has[(i - 1 + n) % n];
      const cur = has[i];
      if (!cur || !prev) return true;
      return k === 'plant' && dir * (cur[0] - prev[0]) >= PLANT_SWITCH_PX;
    };
    let start = 0;
    if (st.loop && n > 1) {
      start = -1;
      for (let i = 0; i < n; i++) if (breaks(i)) {
        start = i;
        break;
      }
      if (start < 0) start = 0; // one plant around the whole loop
    }
    const order = Array.from({ length: n }, (_, j) => (st.loop ? (start + j) % n : j));
    let run: number[] = [];
    const flush = (): void => {
      if (run.length >= 2) {
        const a = has[run[0]] as readonly [number, number];
        const b = has[run[run.length - 1]] as readonly [number, number];
        let moved = 0;
        for (let j = 0; j < run.length - 1; j++) moved += o.perFrame ? speed : speed * st.durations[run[j]];
        const dx = b[0] - a[0] + dir * moved;
        const dy = b[1] - a[1];
        out.push({ point: k, from: run[0], drift: Math.hypot(dx, dy) });
      }
      run = [];
    };
    order.forEach((i, j) => {
      if (j > 0 && breaks(i)) flush();
      if (has[i]) run.push(i);
    });
    flush();
  }
  return out;
}

/**
 * The walking direction that fits the strip best (the smaller worst drift) and its drifts. Only a
 * fallback for sets without `face` (old-frame test sets): a reversed stride fits too.
 */
export function bestPlantDrifts(st: CheckStrip, speed: number, perFrame = false): { dir: 1 | -1; drifts: ReturnType<typeof plantDrifts> } {
  const worst = (d: ReturnType<typeof plantDrifts>): number => d.reduce((m, r) => Math.max(m, r.drift), 0);
  const r = plantDrifts(st, speed, { dir: 1, perFrame });
  const l = plantDrifts(st, speed, { dir: -1, perFrame });
  return worst(l) < worst(r) ? { dir: -1, drifts: l } : { dir: 1, drifts: r };
}

function checkFoot(set: CheckSet, contract: ReadonlyMap<string, ContractEntry> | undefined, s: Sink): SetReport['worstDrift'] {
  let worst: SetReport['worstDrift'] = null;
  for (const [name, st] of Object.entries(set.strips)) {
    const c = st.cls ? actionClass(st.cls) : undefined;
    if (!c?.foot) continue;
    const e = contract?.get(`${set.prefix}/${name}`);
    if (e?.noFoot) {
      s.add('foot', 'info', `no floor contact (contract): ${e.noFoot}`, name);
      continue;
    }
    const speed = e?.speed;
    const plants = st.frames.some((f) => PLANT_POINTS.some((k) => f.pts?.[k]));
    if (speed === undefined) {
      s.add('foot', 'warn', 'no contract speed: foot slide not checked', name);
      continue;
    }
    const unit = e?.perFrame ? 'px/frame' : 'px/tick';
    if (!plants) {
      s.add('foot', 'fail', `locomotion at ${speed} ${unit} without a planted-foot point (${PLANT_POINTS.join(' / ')})`, name);
      continue;
    }
    const face = st.face ?? set.face;
    if (face === undefined) s.add('foot', 'warn', 'the set has no face: the walking direction is guessed (best fit)', name);
    const best = face === undefined ? bestPlantDrifts(st, speed, e?.perFrame) : { dir: face, drifts: plantDrifts(st, speed, { dir: face, ...(e?.perFrame ? { perFrame: true } : {}) }) };
    for (const r of best.drifts) {
      if (!worst || r.drift > worst.drift) worst = { strip: name, drift: r.drift };
      if (r.drift > MAX_FOOT_DRIFT) s.add('foot', 'fail', `"${r.point}" drifts ${r.drift.toFixed(2)} px over the plant from frame ${r.from} (max ${MAX_FOOT_DRIFT}) at ${speed} ${unit}, walking ${best.dir > 0 ? 'right' : 'left'}`, name, r.from);
    }
  }
  return worst;
}

function gateStates(findings: readonly Finding[], skipped: ReadonlySet<Gate>): Record<Gate, GateState> {
  const out = {} as Record<Gate, GateState>;
  for (const g of GATES) {
    const f = findings.filter((x) => x.gate === g);
    out[g] = f.some((x) => x.level === 'fail') ? 'fail' : skipped.has(g) && f.length === 0 ? 'skip' : f.some((x) => x.level === 'warn') ? 'warn' : 'pass';
  }
  return out;
}

/** Run every gate over one set. */
export function checkSet(set: CheckSet, opts: CheckOpts = {}): SetReport {
  const s = new Sink();
  const frames = checkFormat(set, s);
  const { colours, maxFrame } = checkColour(set, frames, s);
  const px = checkPixels(set, frames, s);
  checkClasses(set, s);
  const skipped = new Set<Gate>();
  if (opts.contract) checkContract(set, opts.contract, (gate, level, msg, strip, frame) => s.add(gate, level, msg, strip, frame));
  else skipped.add('contract');
  const worstDrift = checkFoot(set, opts.contract, s);
  const worstTravel = checkSmooth(set, s);
  let nFrames = 0;
  for (const st of Object.values(set.strips)) nFrames += st.frames.length;
  return {
    slug: set.slug,
    prefix: set.prefix,
    budget: set.budget,
    colours,
    maxFrameColours: maxFrame,
    strips: Object.keys(set.strips).length,
    frames: nFrames,
    outlineShare: px.share,
    minStripOutline: px.minStrip,
    orphans: px.orphans,
    halos: px.halos,
    worstTravel,
    worstDrift,
    gates: gateStates(s.findings, skipped),
    findings: s.findings,
  };
}

/** True when no gate failed. */
export function setPassed(r: SetReport): boolean {
  return !Object.values(r.gates).includes('fail');
}
