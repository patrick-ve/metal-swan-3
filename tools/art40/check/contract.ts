/**
 * The contract gate (plan "Rules: replaced correctly" 1-4): a baked set against
 * docs/design/ams40/contract.json (tools/art40/contract/extract.ts). `readContract` turns the file
 * into ContractEntry records by full id; `checkContract` compares a set with them.
 *
 * What the contract gives per id today (extract.ts): frames, size and anchor per frame, the point
 * names (one list for every frame, or one list per frame), ticksPerFrame / durations, loop,
 * defer, totalTicks, class, skip (out of scope under an in-scope prefix). Per character: rules
 * with a kind, the strips they cover and a text. The check reads the speed from the 'speed' rules'
 * text ("0.6 px/tick"; "6 px per frame" for an odometer strip; "no floor contact" turns the foot
 * gate off) and reports 'time' rules as warnings when the total ticks change. Structured fields
 * win when the contract has them: `speed`, `perFrame`, `noFoot` (noFoot wins over a speed),
 * `anchorKind` ('feet': pixels below the anchor fail, an airborne frame warns), `readPoints` (only these
 * points are required), `logicTicks`, `shownTicks` and `events` ([{ name, tick, kind }]).
 */
import { existsSync, readFileSync } from 'node:fs';
import { actionClass } from './classes';
import type { CheckSet, Gate, Level } from './types';

export interface ContractEvent {
  name: string;
  /** The logic tick the event happens at (from the strip start). */
  tick?: number;
  /** 'frame': the baked constant is a frame index whose start tick is `tick`; 'tick': it is the tick. */
  kind?: 'frame' | 'tick';
}

export interface ContractEntry {
  id: string;
  /** The strip's set prefix without the trailing '/' and the strip name. */
  set?: string;
  strip?: string;
  /** Out of scope (the reason): never required of a baked set. */
  skip?: string;
  frames?: number;
  durations?: number[];
  ticksPerFrame?: number;
  totalTicks?: number;
  loop?: boolean;
  defer?: boolean;
  /**
   * Anchor kind: 'feet' when every old frame had its anchor on its bottom row (oy == h: the
   * contract's `anchorKind`, or derived from per-frame anchors), else the old anchor point.
   */
  anchor?: string | readonly [number, number];
  /** Point names on each old frame (index = old frame). */
  framePoints?: string[][];
  /**
   * The point names the code reads (an empty list: none). When present, rule 3 asks only for these
   * (on the new frames that map in time onto old frames that had them); absent: every old point.
   */
  readPoints?: string[];
  /** Total ticks the code relies on (rule 4): the new durations must sum to it. */
  logicTicks?: number;
  /** The code shows the strip only this long from its start: frames starting later are never seen. */
  shownTicks?: number;
  events?: ContractEvent[];
  /** Ground speed of the entity on this strip in px per tick (per frame when `perFrame`). */
  speed?: number;
  perFrame?: boolean;
  /** The strip has no floor contact (pedalling, flying): the reason. */
  noFoot?: string;
  /** The contract's action class id. */
  cls?: string;
  /** Texts of the 'time' rules that cover the strip. */
  timeRules?: string[];
}

export const CONTRACT_PATH = 'docs/design/ams40/contract.json';

type Json = Record<string, unknown>;

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strs(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (v && typeof v === 'object') return Object.keys(v);
  return undefined;
}

function sum(a: readonly number[]): number {
  return a.reduce((x, y) => x + y, 0);
}

/** Speed facts of a 'speed' rule text. */
export function parseSpeedRule(text: string): { speed?: number; perFrame?: boolean; noFoot?: string } {
  if (/no (floor|foot) contact/i.test(text)) return { noFoot: text.length > 90 ? `${text.slice(0, 90)}…` : text };
  const odo = /odometer/i.test(text) ? /(\d+(?:\.\d+)?)\s*px per frame/i.exec(text) : null;
  if (odo) return { speed: Number(odo[1]), perFrame: true };
  const m = /(\d+(?:\.\d+)?)\s*px\s*\/\s*tick/i.exec(text) ?? /(\d+(?:\.\d+)?)\s*px per tick/i.exec(text);
  return m ? { speed: Number(m[1]) } : {};
}

/** One id record of the contract (tolerant of field names). */
export function normalizeEntry(id: string, raw: Json): ContractEntry {
  const e: ContractEntry = { id };
  if (typeof raw.set === 'string') e.set = raw.set.replace(/\/$/, '');
  if (typeof raw.strip === 'string') e.strip = raw.strip;
  if (typeof raw.skip === 'string' && raw.skip) e.skip = raw.skip;
  else if (raw.skip === true) e.skip = 'skip';
  const frames = num(raw.frames) ?? (Array.isArray(raw.frames) ? raw.frames.length : undefined);
  if (frames !== undefined) e.frames = frames;
  if (Array.isArray(raw.durations)) e.durations = raw.durations.filter((x): x is number => typeof x === 'number');
  const tpf = num(raw.ticksPerFrame);
  if (tpf !== undefined) e.ticksPerFrame = tpf;
  const tt = num(raw.totalTicks);
  if (tt !== undefined) e.totalTicks = tt;
  if (typeof raw.loop === 'boolean') e.loop = raw.loop;
  if (typeof raw.defer === 'boolean') e.defer = raw.defer;
  if (typeof raw.class === 'string') e.cls = raw.class;
  // Anchor: a kind, one point, or one point per frame (with `size` per frame).
  if (raw.anchorKind === 'feet') e.anchor = 'feet';
  else if (typeof raw.anchor === 'string') e.anchor = raw.anchor;
  else if (Array.isArray(raw.anchor) && raw.anchor.length && Array.isArray(raw.anchor[0])) {
    const an = raw.anchor as Array<[number, number]>;
    const sz = Array.isArray(raw.size) ? (raw.size as Array<[number, number]>) : [];
    if (sz.length === an.length && an.every(([, y], i) => y === sz[i][1])) e.anchor = 'feet';
  } else if (Array.isArray(raw.anchor) && raw.anchor.length === 2) e.anchor = raw.anchor as [number, number];
  // Points: `points` (string[] = every frame; string[][] = per frame), or framePoints, or frames[].pts.
  const pts = raw.points;
  if (Array.isArray(pts) && pts.length && Array.isArray(pts[0])) e.framePoints = (pts as unknown[]).map((x) => strs(x) ?? []);
  else if (Array.isArray(pts)) {
    if (pts.length) e.readPoints = strs(pts);
  } else if (Array.isArray(raw.framePoints)) e.framePoints = raw.framePoints.map((x) => strs(x) ?? []);
  else if (Array.isArray(raw.frames)) e.framePoints = (raw.frames as Json[]).map((f) => strs(f?.pts ?? f?.points) ?? []);
  const read = strs(raw.readPoints);
  if (read) e.readPoints = read;
  const lt = num(raw.logicTicks);
  if (lt !== undefined) e.logicTicks = lt;
  const sh = num(raw.shownTicks);
  if (sh !== undefined) e.shownTicks = sh;
  const ev = raw.events;
  if (Array.isArray(ev)) {
    e.events = (ev as Json[]).filter((x) => typeof x?.name === 'string').map((x) => ({
      name: x.name as string,
      ...(num(x.tick) !== undefined ? { tick: num(x.tick) } : {}),
      ...(x.kind === 'frame' || x.kind === 'tick' ? { kind: x.kind } : {}),
    }));
  } else if (ev && typeof ev === 'object') {
    e.events = Object.entries(ev as Json).map(([name, v]) => {
      if (typeof v === 'number') return { name, tick: v };
      const o = (v ?? {}) as Json;
      return { name, ...(num(o.tick) !== undefined ? { tick: num(o.tick) } : {}), ...(o.kind === 'frame' || o.kind === 'tick' ? { kind: o.kind } : {}) };
    });
  }
  const sp = num(raw.speed);
  if (sp !== undefined) e.speed = sp;
  if (raw.perFrame === true) e.perFrame = true;
  if (typeof raw.noFoot === 'string' && raw.noFoot) e.noFoot = raw.noFoot;
  return e;
}

interface RuleJson {
  kind?: string;
  strips?: string[];
  text?: string;
}

/** Contract entries by full id from parsed JSON ({ ids: { [id]: {...} }, characters: [{ key, rules }] }, or { ids: [{ id }] }). */
export function contractFromJson(j: unknown): Map<string, ContractEntry> {
  const out = new Map<string, ContractEntry>();
  if (!j || typeof j !== 'object') return out;
  const root = j as Json;
  const ids = root.ids ?? root.sprites ?? root;
  const raws = new Map<string, Json>();
  if (Array.isArray(ids)) {
    for (const r of ids as Json[]) if (typeof r?.id === 'string') raws.set(r.id, r);
  } else if (ids && typeof ids === 'object') {
    for (const [id, r] of Object.entries(ids as Json)) if (id.includes('/') && r && typeof r === 'object') raws.set(id, r as Json);
  }
  const rules = new Map<string, RuleJson[]>();
  if (Array.isArray(root.characters)) for (const c of root.characters as Json[]) if (typeof c?.key === 'string' && Array.isArray(c.rules)) rules.set(c.key, c.rules as RuleJson[]);
  for (const [id, r] of raws) {
    const e = normalizeEntry(id, r);
    const strip = e.strip ?? id.slice(id.lastIndexOf('/') + 1);
    for (const rule of rules.get(typeof r.character === 'string' ? r.character : '') ?? []) {
      if (!rule.strips || !(rule.strips.includes(strip) || rule.strips.includes('*')) || typeof rule.text !== 'string') continue;
      if (rule.kind === 'speed' && e.speed === undefined && !e.noFoot && rule.strips.includes(strip)) {
        const sp = parseSpeedRule(rule.text);
        if (sp.noFoot) e.noFoot = sp.noFoot;
        else if (sp.speed !== undefined) {
          e.speed = sp.speed;
          if (sp.perFrame) e.perFrame = true;
        }
      }
      if (rule.kind === 'time') (e.timeRules ??= []).push(rule.text);
    }
    out.set(id, e);
  }
  return out;
}

/** The contract, or undefined when the file does not exist yet. */
export function readContract(path = CONTRACT_PATH): Map<string, ContractEntry> | undefined {
  if (!existsSync(path)) return undefined;
  return contractFromJson(JSON.parse(readFileSync(path, 'utf8')));
}

type Add = (gate: Gate, level: Level, msg: string, strip?: string, frame?: number) => void;

function starts(durations: readonly number[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const d of durations) {
    out.push(t);
    t += d;
  }
  return out;
}

/** The prefixes a set registers (its own and its variants'). */
export function setPrefixes(set: CheckSet): string[] {
  return [set.prefix, ...Object.keys(set.variants ?? {})];
}

function short(s: string): string {
  return s.length > 110 ? `${s.slice(0, 110)}…` : s;
}

export function checkContract(set: CheckSet, contract: ReadonlyMap<string, ContractEntry>, add: Add): void {
  const strips = Object.keys(set.strips);
  const prefixes = setPrefixes(set);
  // Rule 1: same ids (for the set and every variant prefix), except the out-of-scope ones.
  for (const p of prefixes) {
    if (contract.has(p) && !contract.get(p)?.skip) add('contract', 'warn', `contract id "${p}" is the bare prefix: a baked set cannot register it`);
    for (const [id, c] of contract) {
      if (c.skip || !id.startsWith(`${p}/`)) continue;
      const name = id.slice(p.length + 1);
      if (!set.strips[name]) add('contract', 'fail', `contract id "${id}" has no strip`, name);
    }
  }
  for (const name of strips) {
    const c = contract.get(`${set.prefix}/${name}`);
    if (!c) add('contract', 'warn', `"${set.prefix}/${name}" is not in the contract (a new id)`, name);
    else if (c.skip) add('contract', 'warn', `"${set.prefix}/${name}" is out of scope in the contract (${c.skip})`, name);
  }
  const have = set.events ?? {};
  for (const name of strips) {
    const c = contract.get(`${set.prefix}/${name}`);
    if (!c || c.skip) continue;
    const st = set.strips[name];
    if (c.loop !== undefined && c.loop !== st.loop) add('contract', 'fail', `loop ${st.loop}, contract ${c.loop}`, name);
    if (c.defer !== undefined && c.defer !== Boolean(st.defer)) add('contract', 'warn', `defer ${Boolean(st.defer)}, contract ${c.defer}`, name);
    if (c.cls && st.cls) {
      const a = actionClass(c.cls)?.name;
      const b = actionClass(st.cls)?.name;
      if (a && b && a !== b) add('contract', 'warn', `class ${st.cls}, the contract says ${c.cls}`, name);
    }
    const total = sum(st.durations);
    // Rule 4: logic time (structured), else the 'time' rules as warnings.
    if (c.logicTicks !== undefined) {
      if (total !== c.logicTicks) add('contract', 'fail', `${total} ticks, the code relies on ${c.logicTicks}`, name);
    } else if (c.timeRules?.length && c.totalTicks !== undefined && total !== c.totalTicks) {
      add('contract', 'warn', `${total} ticks, today ${c.totalTicks}; time rule: ${short(c.timeRules[0])}`, name);
    }
    // Rule 4: events.
    const st0 = starts(st.durations);
    for (const ev of c.events ?? []) {
      const v = have[ev.name];
      if (v === undefined) {
        add('contract', 'fail', `event constant ${ev.name} is missing`, name);
        continue;
      }
      if (ev.tick === undefined) continue;
      const asFrame = v < st.frames.length ? st0[v] : undefined;
      const ok = ev.kind === 'tick' ? v === ev.tick : ev.kind === 'frame' ? asFrame === ev.tick : v === ev.tick || asFrame === ev.tick;
      if (!ok) add('contract', 'fail', `event ${ev.name} = ${v} (frame start tick ${asFrame ?? '-'}), the contract tick is ${ev.tick}`, name);
    }
    // Shown window: the code switches away after shownTicks, so later frames are never seen.
    if (c.shownTicks !== undefined) {
      const unseen = st0.flatMap((t, i) => (t >= (c.shownTicks as number) ? [i] : []));
      if (unseen.length) add('contract', 'warn', `the code shows only the first ${c.shownTicks} ticks: frame(s) ${unseen.join(', ')} are never seen`, name);
    }
    // Rule 2: the feet anchor stays the ground line where every old frame had it on its bottom
    // row: no pixel below it (a sunk figure fails); a frame drawn above it (oy > h: airborne, a run's
    // flight phase) warns, because the code moves the body too and a lift in the art adds to it.
    if (c.anchor === 'feet') {
      const sunk = st.frames.flatMap((f, i) => (f.oy < f.h ? [i] : []));
      const lifted = st.frames.flatMap((f, i) => (f.oy > f.h ? [i] : []));
      if (sunk.length) add('contract', 'fail', `pixels below the feet anchor on frame(s) ${sunk.join(', ')} (every old frame stood on it; rule 2)`, name);
      if (lifted.length) add('contract', 'warn', `frame(s) ${lifted.join(', ')} drawn above the feet anchor (airborne): the code's own lift adds to it`, name);
    } else if (Array.isArray(c.anchor)) {
      add('contract', 'info', `old anchor (${c.anchor.join(', ')}) on every frame (a joined or custom anchor: keep its role)`, name);
    }
    // Rule 3: points the code reads. Per-frame lists map by time onto the old frames; when the
    // contract names the read points, only those count (an old frame's other points are free).
    const read = c.readPoints ? new Set(c.readPoints) : null;
    if (c.framePoints && c.framePoints.length) {
      const old = c.framePoints;
      const oldDur = c.durations && c.durations.length ? old.map((_, i) => (c.durations as number[])[i % (c.durations as number[]).length]) : old.map(() => c.ticksPerFrame ?? 1);
      const oldStart = starts(oldDur);
      const oldTotal = sum(oldDur);
      st.frames.forEach((f, j) => {
        const mid = ((st0[j] + st.durations[j] / 2) / Math.max(1, total)) * oldTotal;
        let k = 0;
        while (k + 1 < old.length && oldStart[k + 1] <= mid) k++;
        const miss = old[k].filter((n) => (!read || read.has(n)) && !f.pts?.[n]);
        if (miss.length) add('contract', 'fail', `missing point(s) ${miss.join(', ')} (old frame ${k} had them; the code reads them)`, name, j);
      });
    } else if (c.readPoints?.length) {
      st.frames.forEach((f, j) => {
        const miss = (c.readPoints as string[]).filter((n) => !f.pts?.[n]);
        if (miss.length) add('contract', 'fail', `missing point(s) ${miss.join(', ')} (on every old frame)`, name, j);
      });
    }
  }
}
